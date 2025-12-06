import { authAPI } from "./authAPI";

// Simplified helper for Gala Wallet only.
// Expects a Gala provider (window.gala) and an account string.
// Returns { token, profile } on success or throws an Error with code.
export async function loginWithWallet(provider, account) {
  if (!provider) throw new Error("No Gala wallet provider available");
  if (!account) throw new Error("No account provided");

  // 1) Request server challenge
  const signRes = await authAPI.getSignMessage(account);
  const message = signRes.data.message;
  const timeStamp = signRes.data.timestamp;
  if (!message) throw new Error("Server did not return a signable message");

  // 2) Ask Gala provider to sign
  let signature;
  try {
    // Try different signing methods supported by Gala wallet
    // First try: personal_sign (EIP-191)
    if (provider.request) {
      signature = await provider.request({ method: "personal_sign", params: [message, account] });
    }
    // Fallback: eth_sign
    else if (!signature && provider.request) {
      signature = await provider.request({ method: "eth_sign", params: [account, message] });
    }
    // Fallback: legacy enable + signPersonalMessage
    else if (!signature && provider.send) {
      signature = await provider.send("personal_sign", [message, account]);
    }

  } catch (err) {
    // Normalize user rejection
    if (err && (err.code === 4001 || /user rejected/i.test(err.message || ""))) {
      const e = new Error("User rejected the request");
      e.code = "USER_REJECTED";
      throw e;
    }
    console.error("Signing error:", err);
    throw err;
  }

  if (!signature) throw new Error("Wallet did not return a signature");

  // 3) Send signature to backend to authenticate
  const loginRes = await authAPI.login(account, message, signature,timeStamp);
  // Backend returns { token, profile } after authAPI extracts nested data
  if (!loginRes?.token) throw new Error("Backend did not return authentication token");
  return loginRes;
}

export default loginWithWallet;
