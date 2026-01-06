// src/components/MintModal.jsx
import { useEffect, useState } from "react";
import { ethers, verifyMessage, Signature, hashMessage, getAddress ,TypedDataEncoder} from "ethers";



export default function MintModal({ isOpen, onClose, onSuccess, faction: selectedFactionProp, client, account, onMintingChange }) {
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null);

  // Used for visual reveal
  const [glowColor, setGlowColor] = useState("purple");
  const [faction, setFaction] = useState(null);
  const [rarity, setRarity] = useState("common");

  // Factions list
  const factions = ["Frost", "Inferno", "Nature", "Storm"];
  const factions_images = {
    Frost: "https://gateway.pinata.cloud/ipfs/bafybeid3sfqwu4innxxd7wunnapfvqhylstl6lstwvtffljwwbb5m74ffy",
    Inferno: "https://gateway.pinata.cloud/ipfs/bafybeiaaty7r76r7mxsrqu2hrgt6jz2xcg3mwzpzbnbdtlboyym522joqe",
    Nature: "https://gateway.pinata.cloud/ipfs/bafybeici6cf2ykq4bnwjbxfueg4w3sziu3ghm64dioaxidh6jg36mhqose",
    Storm: "https://gateway.pinata.cloud/ipfs/bafybeigcof4zyinovl7jzkudxgrndeztbekyddccvvkxwjqv63f4pzzubu",
  };

  // Rarity table
  const rarityRoll = () => {
    const r = Math.random();
    if (r < 0.02) return "legendary";
    if (r < 0.12) return "epic";
    if (r < 0.32) return "rare";
    return "common";
  };

  // Aura colors by rarity
  const rarityGlow = {
    common: "shadow-[0_0_30px_rgba(200,200,200,0.3)]",
    rare: "shadow-[0_0_40px_rgba(56,189,248,0.6)]",
    epic: "shadow-[0_0_45px_rgba(168,85,247,0.7)]",
    legendary: "shadow-[0_0_50px_rgba(252,211,77,1)]",
  };

  const rarityText = {
    common: "text-gray-200",
    rare: "text-sky-300",
    epic: "text-purple-300",
    legendary: "text-amber-300",
  };

  useEffect(() => {
    if (!isOpen) {
      setPhase("idle");
      setResult(null);
      setFaction(null);
      setRarity("common");
      return;
    }

    // If no client/account, show error
    if (!client || !account) {
      setPhase("error");
      return;
    }

    // If no faction selected, use random
    const selectedFaction = selectedFactionProp || factions[Math.floor(Math.random() * factions.length)];
    setFaction(selectedFaction);

    // Start animation after small delay
    setTimeout(() => setPhase("charging"), 100);

    // Glow color per faction (soft)
    const glow = {
      Frost: "cyan",
      Inferno: "red",
      Nature: "green",
      Storm: "yellow",
    };
    setGlowColor(glow[selectedFaction]);

    // Call onchain mint function
    const performMint = async () => {
      try {
        if (onMintingChange) onMintingChange(true);
        
        // Move to reveal phase while minting
        setTimeout(() => {
          setPhase("reveal");
        }, 1500);


        console.log(faction,account,client);
        

        // Normalize faction to match contract enum values
        const normalizeFaction = (faction) => {
          const normalized = String(faction).trim();
          const lower = normalized.toLowerCase();
          const factionMap = {
            frost: "Frost",
            inferno: "Inferno",
            nature: "Nature",
            storm: "Storm",
          };
          if (factionMap[lower]) return factionMap[lower];
          if (["Frost", "Inferno", "Nature", "Storm"].includes(normalized)) return normalized;
          throw new Error(`Invalid faction: ${faction}`);
        };

        // Generate unique key
        const generateUniqueKey = () => {
          return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        };

        // Format address with eth| prefix
        const formatAddress = (address) => {
          if (!address) throw new Error("Address is required");
          const addr = String(address).trim();
          if (addr.startsWith("eth|")) return addr;
          return `eth|${addr}`;
        };

        // Get ethereum provider for signing
        const ethereumProvider = typeof window !== "undefined" ? window.ethereum : null;
        if (!ethereumProvider) {
          throw new Error("Ethereum provider (window.ethereum) is required for signing");
        }

        // Get account address (strip eth| prefix if present for signing)
        const stripPrefix = (addr) => addr?.startsWith("eth|") ? addr.substring(4) : addr;
        const signerAddress = stripPrefix(account);
        
        // Normalize faction
        const normalizedFaction = normalizeFaction(selectedFaction);
        
        // Create message to sign
        const message = JSON.stringify(dtoPayload);
        console.log("-------------------message",message);
        // Sign the message
        let signature;
        try {
          const uniqueKey = `arcano-public-key-${Math.random()}-${Date.now()}`;
          const typedData = {
            domain: {
              name: "GalaChain",
              version: "1",
            },
            primaryType: "Register GalaChain Wallet",
            types: {
              "Register GalaChain Wallet": [
                { name: "UniqueKey", type: "string" },
              ],
            },
            message: {
              UniqueKey: uniqueKey,
            },
          };
          signature = await ethereumProvider.request({
            method: "eth_signTypedData_v4",
            params: [
              signerAddress.replace("eth|", ""), // MUST be 0x address
              JSON.stringify({
                domain: typedData.domain,
                primaryType: typedData.primaryType,
                message: typedData.message,
                types: {
                  EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "version", type: "string" },
                  ],
                  ...typedData.types,
                },
              }),
            ],
          });

          const digest = TypedDataEncoder.hash(
            typedData.domain,
            typedData.types,
            typedData.message
          );
          const publicKey = verifyMessage(digest, signature);
          console.log("-------------------signature",publicKey,signature);
          
        } catch (err) {
          if (err.code === 4001 || /user rejected/i.test(err.message || "")) {
            const e = new Error("User rejected the signature request");
            e.code = "USER_REJECTED";
            throw e;
          }
          throw err;
        }

        let signerPublicKey = "";
        try {
          const msgHash = ethers.hashMessage(message);
          const publicKey = ethers.SigningKey.recoverPublicKey(
            msgHash,
            signature
          ).replace(/^0x/, "");
          signerPublicKey=publicKey;
        } catch (e) {
          console.error("Failed to recover public key from signature:", e);
          signerPublicKey = "";
        }
        const requestBody = {
          dtoExpiresAt: dtoPayload.dtoExpiresAt,
          dtoOperation: dtoPayload.dtoOperation,
          faction: dtoPayload.faction,
          galaAmount: dtoPayload.galaAmount,
          multisig: dtoPayload.multisig,
          ownerAddress: dtoPayload.ownerAddress,
          signature: signature,
          // signerAddress: formatAddress(signerAddress), 
          // signerPublicKey: signerPublicKey, // Recovered public key or empty string
          signing: "ETH",
          uniqueKey: dtoPayload.uniqueKey,
        };
        console.log("-------------------requestBody",requestBody);

        // Send request to GalaChain API
        const response = await fetch('https://gateway-testnet.galachain.com/api/testnet04/gc-6ce56fd3c2df7a3a0f8f1710574c513ef361c5ed-EggContract/MintByUser', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        console.log("Response data:", data);

        if (!response.ok || data.Status === 0) {
          throw new Error(data.Message || `HTTP ${response.status}: Failed to mint egg`);
        }

        const eggNFT = data.Data;
        
        // Extract rarity from egg NFT (if available) or generate
        const selectedRarity = eggNFT?.rarity?.toLowerCase() || rarityRoll();
        setRarity(selectedRarity);

        // Create mint result from onchain data
        const mintResult = {
          eggId: eggNFT.id || eggNFT.tokenInstanceKey || `egg_${Date.now()}`,
          faction: eggNFT.faction || selectedFaction,
          rarityHint: selectedRarity,
          txHash: eggNFT.id || eggNFT.tokenInstanceKey || "0x" + Math.floor(Math.random() * 1e16).toString(16),
          // Include full NFT data
          nft: eggNFT,
        };

        // Final result phase
        setTimeout(() => {
          setResult(mintResult);
          setPhase("result");
          if (onMintingChange) onMintingChange(false);
        }, 2600);
      } catch (error) {
        console.error("Mint error:", error);
        setPhase("error");
        setResult({
          error: error.message || "Failed to mint egg",
        });
        if (onMintingChange) onMintingChange(false);
      }
    };

    // performMint();
  }, [isOpen, selectedFactionProp, client, account, onMintingChange]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (result && !result.error) {
      onSuccess(result);
    } else {
      onClose();
    }
  };

  // Error phase
  const ErrorFX = () => (
    <div className="flex flex-col items-center">
      <div className="w-40 h-40 rounded-full bg-red-900/50 border-2 border-red-500 flex items-center justify-center">
        <span className="text-4xl">⚠</span>
      </div>
      <p className="text-red-400 text-lg font-semibold mt-4">Minting Failed</p>
      <p className="text-gray-400 text-sm text-center mt-2">
        {result?.error || "Please ensure your wallet is connected and try again."}
      </p>
      <button
        onClick={onClose}
        className="mt-4 w-full py-3 rounded-xl bg-red-600 hover:bg-red-700
                  font-semibold text-white transition"
      >
        Close
      </button>
    </div>
  );

  // PHASE 1 — Charging animation
  const ChargingFX = () => (
    <div className="flex flex-col items-center">
      <div className="
        w-40 h-40 rounded-full bg-gradient-to-br from-purple-700 to-purple-900
        animate-pulse shadow-[0_0_40px_rgba(168,85,247,0.7)]
      " />
      <p className="text-purple-300 text-sm mt-4 animate-pulse">Summoning energy...</p>
    </div>
  );

  // PHASE 2 — Egg materializing
  const RevealFX = () => (
    <div className="flex flex-col items-center transition-all duration-500">
      <div
        className={`w-44 h-44 rounded-full bg-black/80 border-2 border-white/10 flex items-center justify-center
        shadow-lg ${rarityGlow[rarity]} animate-[pulse_0.8s_infinite]`}
      >
        <img
          src={factions_images[faction] || `/images/eggs/${faction?.toLowerCase()}.png`}
          alt=""
          className="w-24 h-24 object-contain animate-[bounce_1.2s_infinite]"
        />
      </div>

      <p className={`${rarityText[rarity]} text-lg font-semibold mt-3`}>
        {faction} Egg Appears!
      </p>
      <p className="text-gray-400 text-sm">{rarity.toUpperCase()} rarity</p>
    </div>
  );

  // PHASE 3 — Final result screen
  const ResultFX = () => (
    <div className="flex flex-col items-center">
      <div
        className={`w-48 h-48 rounded-full bg-black border border-white/40 flex items-center justify-center ${rarityGlow[rarity]}`}
      >
        <img
          src={`${factions_images[`${faction}`]}`}
          alt=""
          className="object-contain rounded-full w-47 h-47"
        />
      </div>

      <p className={`${rarityText[rarity]} text-xl font-bold mt-4`}>
        {faction} Egg
      </p>
      <p className="text-gray-300 text-sm tracking-wide mb-4">
        Rarity: {rarity.toUpperCase()}
      </p>

      <button
        onClick={handleConfirm}
        className="mt-3 w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700
                  font-semibold text-white transition shadow-lg"
      >
        Claim Egg
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xl flex items-center justify-center z-50 px-4">
      <div className="relative bg-black border border-white/15 rounded-3xl max-w-sm w-full p-6">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white text-xl"
        >
          ×
        </button>

        {/* Modal body */}
        {phase === "charging" && <ChargingFX />}
        {phase === "reveal" && <RevealFX />}
        {phase === "result" && <ResultFX />}
        {phase === "error" && <ErrorFX />}

        {phase === "idle" && (
          <p className="text-white text-center">Preparing...</p>
        )}
      </div>
    </div>
  );
}



