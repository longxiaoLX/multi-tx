import * as web3 from "@solana/web3.js";
import fs from "fs";
import { decode, encode } from "bs58";

export function loadKeypair(jsonPath: string): web3.Keypair {
    return web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(jsonPath).toString())));
}

export function encodeAndWriteTranction(
    tx: web3.Transaction,
    filename: string,
    requireAllSignatures = true,
) {
    // 需要所有的签名出现在交易中
    // 但是，部分签名的交易没有所有的签名，因此调用这个函数的时候需要将 requireAllSignatures 设置为 false
    const serialisedTx = encode(tx.serialize({ requireAllSignatures }));
    fs.writeFileSync(filename, serialisedTx);
    console.log(`Tx written to ${filename}`);
    return serialisedTx
}

export function readAndDecodeTranction(filename: string): web3.Transaction {
    const transactionData = fs.readFileSync(filename, 'utf8');
    const decodedData = decode(transactionData);
    const tranction = web3.Transaction.from(decodedData);
    return tranction
}