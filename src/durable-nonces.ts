import * as web3 from "@solana/web3.js";
import { encodeAndWriteTranction, readAndDecodeTranction } from "./utils";

export async function sendNonceTranction(
    connection: web3.Connection,
    nonceAuthKeypair: web3.Keypair,
    nonceKeypair: web3.Keypair,
    senderKeypair: web3.Keypair,
) {
    try {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        // Create nonce and get its creation tranction signature
        const nonceCreationTxSig = await nonce(connection, nonceAuthKeypair, nonceKeypair, senderKeypair);

        // Ensure nonce account creation is confirmed before moving forward
        const confirmationStatus = await connection.confirmTransaction({
            signature: nonceCreationTxSig,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
        });
        if (!confirmationStatus.value.err) {
            console.log("Nonce account creation confirmed.");

            const nonce = await getNonce(connection, nonceKeypair);
            await createTx(nonce, senderKeypair, nonceAuthKeypair, nonceKeypair);
            await signOffline(10000, senderKeypair, nonceAuthKeypair);
            await executeTx(connection);
        } else {
            console.error(
                "Nonce account creation transaction failed: ",
                confirmationStatus.value.err,
            )
        }
    } catch (error) {
        console.error(error);
    }
}

async function nonce(
    connection: web3.Connection,
    nonceAuthKeypair: web3.Keypair,
    nonceKeypair: web3.Keypair,
    payer: web3.Keypair,
) {
    // For creating the nonce account
    const rent = await connection.getMinimumBalanceForRentExemption(web3.NONCE_ACCOUNT_LENGTH);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const createNonceTx = new web3.Transaction().add(
        web3.SystemProgram.createAccount({
            fromPubkey: nonceAuthKeypair.publicKey,
            newAccountPubkey: nonceKeypair.publicKey,
            lamports: rent,
            space: web3.NONCE_ACCOUNT_LENGTH,
            programId: web3.SystemProgram.programId,
        })
    );

    createNonceTx.feePayer = payer.publicKey;
    createNonceTx.recentBlockhash = blockhash;
    createNonceTx.lastValidBlockHeight = lastValidBlockHeight;
    createNonceTx.sign(nonceAuthKeypair, nonceKeypair, payer);

    try {
        // Create the nonce account
        const signature = await connection.sendRawTransaction(
            createNonceTx.serialize(),
            { skipPreflight: false, preflightCommitment: "confirmed" }
        );
        const confirmationStatus = await connection.confirmTransaction({
            signature: signature,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
        });
        if (confirmationStatus.value.err) {
            throw new Error(
                "Nonce account creation tranction failed: " +
                confirmationStatus.value.err,
            );
        }
        console.log("Nonce account created: ", signature);

        // Now, initialize the nonce
        const initializeNonceTx = new web3.Transaction().add(
            web3.SystemProgram.nonceInitialize({
                noncePubkey: nonceKeypair.publicKey,
                authorizedPubkey: nonceAuthKeypair.publicKey,
            })
        );

        const { blockhash: initBlockhash, lastValidBlockHeight: initValidBlockHeight } = await connection.getLatestBlockhash();
        initializeNonceTx.feePayer = payer.publicKey;
        initializeNonceTx.recentBlockhash = initBlockhash;
        initializeNonceTx.lastValidBlockHeight = initValidBlockHeight;
        initializeNonceTx.sign(payer); // only sign with nonceAuthKeypair

        const initSignature = await connection.sendRawTransaction(
            initializeNonceTx.serialize(),
            { skipPreflight: false, preflightCommitment: "confirmed" },
        );
        const initConfirmationStatus = await connection.confirmTransaction({
            signature: initSignature,
            blockhash: initBlockhash,
            lastValidBlockHeight: lastValidBlockHeight,
        });
        if (initConfirmationStatus.value.err) {
            throw new Error("Nonce initializtion tranction failed: " + initConfirmationStatus.value.err);
        }
        console.log("Nonce initialized: ", initSignature);
        return initSignature

    } catch (error) {
        console.error(`Failed in createNonce function: ${error}`);
        throw error;
    }
}

async function getNonce(
    connection: web3.Connection,
    nonceKeypair: web3.Keypair,
) {
    const nonceAccount = await fetchNonceInfo(undefined, connection, nonceKeypair);
    return nonceAccount.nonce
}

async function createTx(
    nonce: string,
    senderKeypair: web3.Keypair,
    nonceAuthKeypair: web3.Keypair,
    nonceKeypair: web3.Keypair,
) {
    const destination = web3.Keypair.generate();
    const advanceIx = web3.SystemProgram.nonceAdvance({
        authorizedPubkey: nonceAuthKeypair.publicKey,
        noncePubkey: nonceKeypair.publicKey,
    });
    const transferIx = web3.SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: destination.publicKey,
        lamports: web3.LAMPORTS_PER_SOL * 0.005,
    });

    const sampleTx = new web3.Transaction();
    sampleTx.add(advanceIx, transferIx);
    // Use the nonce fetched earlier
    sampleTx.recentBlockhash = nonce;
    sampleTx.feePayer = senderKeypair.publicKey;

    const unsignedFilepath = "/home/xiaolong/solana-learn/multi-tx/unsigned-tx/unsigned.json";
    const serialisedTx = encodeAndWriteTranction(
        sampleTx,
        unsignedFilepath,
        false,
    );
    return serialisedTx

}

async function signOffline(
    waitTime = 120000,
    senderKeypair: web3.Keypair,
    nonceAuthKeypair: web3.Keypair,
) {
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    const unsignedFilepath = "/home/xiaolong/solana-learn/multi-tx/unsigned-tx/unsigned.json";
    const unsignedTx = readAndDecodeTranction(unsignedFilepath);
    // Sign with both keys
    unsignedTx.sign(senderKeypair, nonceAuthKeypair);
    const signedFilepath = "/home/xiaolong/solana-learn/multi-tx/unsigned-tx/signed.json";
    const serialisedTx = encodeAndWriteTranction(unsignedTx, signedFilepath);
    return serialisedTx
}

async function fetchNonceInfo(
    retries = 3,
    connection: web3.Connection,
    nonceKeypair: web3.Keypair,
): Promise<web3.NonceAccount> {
    while (retries > 0) {
        const accountInfo = await connection.getAccountInfo(nonceKeypair.publicKey);
        if (accountInfo) {
            const nonceAccount = web3.NonceAccount.fromAccountData(accountInfo.data);
            console.log("Auth: ", nonceAccount.authorizedPubkey.toString());
            console.log("Nonce: ", nonceAccount.nonce);
            return nonceAccount
        }
        retries--;
        if (retries > 0) {
            console.log(`Retry fetching nonce in 3 seconds. ${retries} retries left.`)
        };
        await new Promise((res) => setTimeout(res, 3000)); // wait for 3 seconds
    };
    throw new Error("No account info found");

}

async function executeTx(
    connection: web3.Connection,
) {
    const signedFilepath = "/home/xiaolong/solana-learn/multi-tx/unsigned-tx/signed.json";
    const signedTx = readAndDecodeTranction(signedFilepath);
    const sig = await connection.sendRawTransaction(signedTx.serialize());
    console.log("Tx sent: ", sig)
}