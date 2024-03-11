import * as web3 from "@solana/web3.js"

export function transferSOL(
    payer: web3.Keypair,
    blockhash: string,
): web3.VersionedTransaction[] {
    let tranctions: web3.VersionedTransaction[] = [];
    for (let index = 0; index < 2; index++) {
        let txInstructions: web3.TransactionInstruction[] = [];
        let receiver = web3.Keypair.generate().publicKey;
        txInstructions[0] = web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000,
        });
        txInstructions[1] = web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 100_000
        })
        txInstructions[2] = web3.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: receiver,
            lamports: web3.LAMPORTS_PER_SOL * 0.005,
        });
        const message = new web3.TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: blockhash,
            instructions: txInstructions,
        }).compileToLegacyMessage();
        const tranction = new web3.VersionedTransaction(message);
        tranction.sign([payer]);
        tranctions[index] = tranction;
    }
    return tranctions
}