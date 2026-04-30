import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const tokenMint = Keypair.generate();
const initialBuyLamports = 10_000_000;

console.log(JSON.stringify({
  tokenMint: tokenMint.publicKey.toBase58(),
  initialBuyLamports,
  estimatedMinimumSol: initialBuyLamports / LAMPORTS_PER_SOL,
  note: "Bags launch still requires BAGS_API_KEY, SOLANA_RPC_URL, PRIVATE_KEY, metadata upload, fee-share config, signing, and broadcast."
}, null, 2));
