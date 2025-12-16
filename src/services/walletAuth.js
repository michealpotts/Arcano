import { authAPI } from "./authAPI";

export async function loginWithWallet(client, account, ethereumProvider = null) {
  if (!client) throw new Error("No BrowserConnectClient available");
  if (!account) throw new Error("No account provided");

  const signRes = await authAPI.getSignMessage(account);
  const message = signRes.data.message;
  const timeStamp = signRes.data.timestamp;
  if (!message) throw new Error("Server did not return a signable message");

  let signature;
  try {
    if (client.signMessage) {
      signature = await client.signMessage(message);
    } else {
      throw new Error("No signing method available. Please ensure MetaMask is installed.");
    }
  } catch (err) {
    if (err && (err.code === 4001 || /user rejected/i.test(err.message || ""))) {
      const e = new Error("User rejected the request");
      e.code = "USER_REJECTED";
      throw e;
    }
    console.error("Signing error:", err);
    throw err;
  }

  if (!signature) throw new Error("Wallet did not return a signature");

  const loginRes = await authAPI.login(account, message, signature, timeStamp);
  if (!loginRes?.token) throw new Error("Backend did not return authentication token");
  return loginRes;
}

export default loginWithWallet;
