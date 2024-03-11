import * as web3 from "@solana/web3.js"
import { loadKeypair } from "./utils";
import { transferSOL } from "./transfer-sol";
import { sendNonceTranction } from "./durable-nonces";

async function main() {
  const url = "https://devnet.helius-rpc.com/?api-key=9f97157f-9d48-4b80-af08-276beb66ebd4";
  const connection = new web3.Connection(url);
  const payerKeyPath = "/home/xiaolong/solana-learn/multi-tx/keypairs/payer.json";
  const payer = loadKeypair(payerKeyPath);
  // const { blockhash } = await connection.getLatestBlockhash();

  // const tranctions = transferSOL(payer, blockhash);
  // for (let index = 0; index < 2; index++) {
  //   const sig = await connection.sendTransaction(tranctions[index]);
  //   console.log(`The signature of the tx is: ${sig}`);
  // }

  const nonceAuthKeypair = loadKeypair("/home/xiaolong/solana-learn/multi-tx/keypairs/nonce-auth.json");
  const nonce = web3.Keypair.generate();
  // const waitTime = 120000;
  // const transferAmount = web3.LAMPORTS_PER_SOL * 0.01;

  await sendNonceTranction(connection, nonceAuthKeypair, nonce, payer);
}

main().
  then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
