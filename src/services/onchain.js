import { BrowserConnectClient } from '@gala-chain/connect';

// GalaChain Configuration
const GALA_CHAIN_API_URL = 'https://gateway-testnet.galachain.com/api/testnet04';
const CONTRACT_IDS = {
  PUBLICKEY: 'gc-6ce56fd3c2df7a3a0f8f1710574c513ef361c5ed-PublicKeyContract',
  EGG: 'gc-6ce56fd3c2df7a3a0f8f1710574c513ef361c5ed-EggContract',
  CREATURE: 'gc-6ce56fd3c2df7a3a0f8f1710574c513ef361c5ed-CreatureContract',
  INCUBATOR: 'gc-6ce56fd3c2df7a3a0f8f1710574c513ef361c5ed-IncubatorContract',
  SOUL: 'gc-6ce56fd3c2df7a3a0f8f1710574c513ef361c5ed-SoulContract'
};

// Constants
export const FACTIONS = {
  FROST: 'Frost',
  INFERNO: 'Inferno',
  NATURE: 'Nature',
  STORM: 'Storm'
};

export const RARITY = {
  COMMON: 'Common',
  UNCOMMON: 'Uncommon',
  RARE: 'Rare',
  ENHANCED: 'Enhanced',
  ARCANE: 'Arcane',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
  MYSTIC: 'Mystic'
};

export const SPEED_UP_TIERS = {
  TIER_1: 'TIER_1', // 1 hour for 100 GALA
  TIER_2: 'TIER_2', // 4 hours for 300 GALA
  TIER_3: 'TIER_3'  // 8 hours for 500 GALA
};

/**
 * Generate a unique key for transactions
 */
function randomUniqueKey() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Strip eth| prefix from address (for internal use with ethers.js)
 */
function stripAddressPrefix(address) {
  if (!address) return null;
  return address.startsWith('eth|') ? address.substring(4) : address;
}

/**
 * Format address with eth| prefix for GalaChain DTOs
 */
function formatAddress(address) {
  if (!address) return null;
  // First strip any existing prefix, then add it back to ensure consistency
  const rawAddress = stripAddressPrefix(address);
  return `eth|${rawAddress}`;
}

/**
 * Sign a DTO using the wallet provider
 * @param {Object} provider - Wallet provider
 * @param {string} account - User's account address (without eth| prefix)
 * @param {Object} dto - DTO object to sign
 * @param {string} contractName - Contract name (e.g., "EggContract")
 * @param {string} methodName - Method name (e.g., "MintByUser")
 * @returns {Promise<Object>} - Signed DTO ready to send
 */
async function signDto(provider, account, dto, contractName, methodName) {
  if (!provider) {
    throw new Error('Wallet provider is required');
  }
  if (!account) {
    throw new Error('Account address is required');
  }

  // Normalize account address (remove eth| prefix for signing)
  const normalizedAccount = stripAddressPrefix(account);
  
  // Create the DTO payload for signing (without signature fields)
  const dtoPayload = {
    ...dto,
    dtoOperation: `${contractName}:${methodName}`,
    dtoExpiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
  };

  // Create message to sign - stringify the DTO payload
  const message = JSON.stringify(dtoPayload);
  
  // Sign the DTO using the wallet provider
  let signature;
  try {
    if (provider.request) {
      signature = await provider.request({ 
        method: "personal_sign", 
        params: [message, normalizedAccount] 
      });
    } else if (provider.signMessage) {
      signature = await provider.signMessage(message);
    } else {
      throw new Error('Provider does not support signing');
    }
  } catch (error) {
    if (error.code === 4001 || /user rejected/i.test(error.message || "")) {
      const e = new Error("User rejected the signature request");
      e.code = "USER_REJECTED";
      throw e;
    }
    throw error;
  }

  // Create the signed DTO with all required fields
  const signedDto = {
    ...dtoPayload,
    signature: signature,
    signing: 'ETH'
  };
  console.log("-------------------------------------signedDto", signedDto);
  return signedDto;
}

/**
 * Create a normalized provider wrapper that strips eth| prefix from addresses
 * This ensures BrowserConnectClient never sees addresses with the prefix
 * IMPORTANT: We must not modify the provider structure to maintain EIP-1193 compatibility
 */
function createNormalizedProvider(provider) {
  if (!provider) return provider;
  
  // Don't modify the provider object itself - just intercept method calls
  // This maintains EIP-1193 compatibility
  return new Proxy(provider, {
    get(target, prop) {
      const value = target[prop];
      
      // Only intercept method calls that might return addresses
      // Don't modify properties to maintain EIP-1193 compatibility
      if (typeof value === 'function') {
        return function(...args) {
          // Normalize any address arguments in method calls
          const normalizedArgs = args.map(arg => {
            if (typeof arg === 'string' && arg.startsWith('eth|')) {
              return stripAddressPrefix(arg);
            }
            if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
              // Recursively normalize object properties in arguments
              const normalized = { ...arg };
              Object.keys(normalized).forEach(key => {
                if (typeof normalized[key] === 'string' && normalized[key].startsWith('eth|')) {
                  normalized[key] = stripAddressPrefix(normalized[key]);
                } else if (Array.isArray(normalized[key])) {
                  normalized[key] = normalized[key].map(item =>
                    typeof item === 'string' && item.startsWith('eth|') ? stripAddressPrefix(item) : item
                  );
                }
              });
              return normalized;
            }
            return arg;
          });
          
          const result = value.apply(target, normalizedArgs);
          
          // If it's a promise (like eth_accounts, eth_requestAccounts), normalize addresses in the result
          if (result && typeof result.then === 'function') {
            return result.then(resolved => {
              if (Array.isArray(resolved)) {
                return resolved.map(item => {
                  if (typeof item === 'string' && item.startsWith('eth|')) {
                    return stripAddressPrefix(item);
                  }
                  return item;
                });
              }
              if (typeof resolved === 'string' && resolved.startsWith('eth|')) {
                return stripAddressPrefix(resolved);
              }
              if (typeof resolved === 'object' && resolved !== null) {
                // Normalize object properties in results
                const normalized = { ...resolved };
                Object.keys(normalized).forEach(key => {
                  if (typeof normalized[key] === 'string' && normalized[key].startsWith('eth|')) {
                    normalized[key] = stripAddressPrefix(normalized[key]);
                  } else if (Array.isArray(normalized[key])) {
                    normalized[key] = normalized[key].map(item =>
                      typeof item === 'string' && item.startsWith('eth|') ? stripAddressPrefix(item) : item
                    );
                  }
                });
                return normalized;
              }
              return resolved;
            });
          }
          
          return result;
        };
      }
      
      // Return properties as-is to maintain EIP-1193 compatibility
      // Don't modify properties directly - only normalize in method results
      return value;
    }
  });
}

/**
 * Get GalaChain client instance
 * @param {Object} provider - The MetaMask wallet provider (window.ethereum)
 * @returns {Promise<GalaChainClient>}
 */
async function getGalaChainClient(provider) {
  if (!provider) {
    throw new Error('Wallet provider is required');
  }

  try {
    // First, ensure the provider doesn't have any address properties that would break EIP-1193
    // Some wallet wrappers add address properties, which BrowserConnectClient doesn't like
    // We'll create a clean provider that only has EIP-1193 methods
    
    // Get the raw provider (in case it's wrapped)
    const rawProvider = provider.provider || provider;
    
    // Create a minimal EIP-1193 compatible provider
    // Only include standard EIP-1193 methods and properties
    const eip1193Provider = {
      request: rawProvider.request?.bind(rawProvider),
      on: rawProvider.on?.bind(rawProvider),
      removeListener: rawProvider.removeListener?.bind(rawProvider),
      // Include other standard EIP-1193 properties if they exist
      ...(rawProvider.isMetaMask !== undefined && { isMetaMask: rawProvider.isMetaMask }),
      ...(rawProvider.isTrust !== undefined && { isTrust: rawProvider.isTrust }),
      ...(rawProvider.chainId !== undefined && { chainId: rawProvider.chainId }),
      ...(rawProvider.networkVersion !== undefined && { networkVersion: rawProvider.networkVersion }),
    };
    
    // Wrap it with our normalization proxy to handle address formatting
    const normalizedProvider = createNormalizedProvider(eip1193Provider);
    
    // Create BrowserConnectClient with the normalized provider
    const wallet = new BrowserConnectClient(normalizedProvider);
    const connectionResult = await wallet.connect();
    
    // connectionResult is just the address string, normalize it
    const normalizedAddress = typeof connectionResult === 'string' 
      ? stripAddressPrefix(connectionResult) 
      : connectionResult;
    
    // Store provider and address for signing DTOs
    // Use rawProvider for signing to avoid proxy interference
    wallet._provider = rawProvider; // Original provider for signing
    wallet._address = normalizedAddress;
    wallet._apiUrl = GALA_CHAIN_API_URL;
    
    // BrowserConnectClient might not have forContract, so we'll add it
    // Check if BrowserConnectClient has submitTransaction/evaluateTransaction methods
    const hasSubmitTransaction = typeof wallet.submitTransaction === 'function';
    const hasEvaluateTransaction = typeof wallet.evaluateTransaction === 'function';
    
    if (!wallet.forContract) {
      wallet.forContract = function(contractId) {
        const self = this;
        const apiUrl = self._apiUrl || GALA_CHAIN_API_URL;
        const provider = self._provider;
        const userAddress = self._address;
        
        // Helper to call contract methods
        async function callContractMethod(methodName, dto, isSubmit = true) {
          // Extract contract name from contractId (format: "gc-xxx-ContractName")
          const contractName = contractId.split('-').pop() || 'EggContract';
          
          // Get the user's account address from the connection result or DTO
          const userAccount = userAddress || stripAddressPrefix(dto.ownerAddress || dto.owner || dto.userId || dto.buyerAddress);
          
          if (!userAccount) {
            throw new Error('User account address is required for signing DTOs');
          }
          
          // Sign the DTO before sending
          const signedDto = await signDto(provider, userAccount, dto, contractName, methodName);
          
          // If BrowserConnectClient has the methods, use them
          if (isSubmit && hasSubmitTransaction) {
            return await self.submitTransaction(contractId, methodName, signedDto);
          } else if (!isSubmit && hasEvaluateTransaction) {
            return await self.evaluateTransaction(contractId, methodName, signedDto);
          }
          
          // Fallback: call API directly with signed DTO
          const url = `${apiUrl}/${contractId}/${methodName}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signedDto)
          });
          
          if (!response.ok) {
            const error = await response.json().catch(() => ({ Message: `HTTP ${response.status}` }));
            throw new Error(error.Message || `API error: ${response.status}`);
          }
          
          return await response.json();
        }
        
        return {
          // Submit transaction methods (state-changing)
          async MintByUser(dto) { return await callContractMethod('MintByUser', dto, true); },
          async MultiMint(dto) { return await callContractMethod('MultiMint', dto, true); },
          async Transfer(dto) { return await callContractMethod('Transfer', dto, true); },
          async BurnEgg(dto) { return await callContractMethod('BurnEgg', dto, true); },
          async StartIncubation(dto) { return await callContractMethod('StartIncubation', dto, true); },
          async SpeedUpIncubation(dto) { return await callContractMethod('SpeedUpIncubation', dto, true); },
          async ClaimCreature(dto) { return await callContractMethod('ClaimCreature', dto, true); },
          async MintBaby(dto) { return await callContractMethod('MintBaby', dto, true); },
          async Evolve(dto) { return await callContractMethod('Evolve', dto, true); },
          async MintEggFromCreatures(dto) { return await callContractMethod('MintEggFromCreatures', dto, true); },
          async BuySoulWithGala(dto) { return await callContractMethod('BuySoulWithGala', dto, true); },
          // Evaluate transaction methods (read-only)
          async GetEgg(dto) { return await callContractMethod('GetEgg', dto, false); },
          async GetEggsByOwner(dto) { return await callContractMethod('GetEggsByOwner', dto, false); },
          async GetIncubationStatus(dto) { return await callContractMethod('GetIncubationStatus', dto, false); },
          async GetUserIncubations(dto) { return await callContractMethod('GetUserIncubations', dto, false); },
          async GetCreature(dto) { return await callContractMethod('GetCreature', dto, false); },
          async GetCreaturesByOwner(dto) { return await callContractMethod('GetCreaturesByOwner', dto, false); },
          async GetSoulAmount(dto) { return await callContractMethod('GetSoulAmount', dto, false); },
          async GetCurrentRate(dto) { return await callContractMethod('GetCurrentRate', dto, false); },
          // PublicKeyContract methods
          async GetProfile(dto) { return await callContractMethod('GetProfile', dto, false); },
          async RegisterEthUser(dto) { return await callContractMethod('RegisterEthUser', dto, true); }
        };
      };
    }
    
    return wallet;
  } catch (error) {
    // Log the original error for debugging
    console.error('GalaChain client error:', error);
    
    // Check for EIP-1193 provider errors
    if (error.message && error.message.includes('invalid EIP-1193 provider')) {
      const helpfulError = new Error(
        'Wallet provider compatibility error. The wallet provider does not meet EIP-1193 standards. ' +
        'Please ensure you are using MetaMask wallet and try again. ' +
        'If you are using a wallet wrapper, try accessing the underlying provider directly.'
      );
      helpfulError.originalError = error;
      throw helpfulError;
    }
    
    // If error mentions invalid address, provide helpful error message
    if (error.message && (error.message.includes('invalid address') || error.message.includes('INVALID_ARGUMENT'))) {
      // Try to extract the problematic address from the error
      const addressMatch = error.message.match(/value="([^"]+)"/);
      const problematicAddress = addressMatch ? addressMatch[1] : 'unknown';
      
      const helpfulError = new Error(
        `Wallet address format error. The address "${problematicAddress}" contains an invalid format. ` +
        `This usually happens when an address has the "eth|" prefix. ` +
        `Please try disconnecting and reconnecting your wallet, or contact support if the issue persists.`
      );
      helpfulError.originalError = error;
      throw helpfulError;
    }
    throw error;
  }
}

/**
 * ============================================
 * EGG CONTRACT METHODS
 * ============================================
 */

/**
 * Normalize faction name to match contract enum values
 * @param {string} faction - Faction name (any case)
 * @returns {string} Normalized faction: "Frost", "Inferno", "Nature", or "Storm"
 */
function normalizeFaction(faction) {
  if (!faction) throw new Error("Faction is required");
  
  const normalized = String(faction).trim();
  const lower = normalized.toLowerCase();
  
  // Map common variations to correct enum values
  const factionMap = {
    frost: "Frost",
    inferno: "Inferno",
    nature: "Nature",
    storm: "Storm",
  };
  
  if (factionMap[lower]) {
    return factionMap[lower];
  }
  
  // If already in correct format, return as-is
  if (["Frost", "Inferno", "Nature", "Storm"].includes(normalized)) {
    return normalized;
  }
  
  throw new Error(`Invalid faction: ${faction}. Must be one of: Frost, Inferno, Nature, Storm`);
}

/**
 * Mint a single egg
 * @param {Object} provider - Gala wallet provider (BrowserConnectClient or window.ethereum)
 * @param {string} ownerAddress - Owner's wallet address
 * @param {string} faction - Faction (Frost, Inferno, Nature, Storm)
 * @param {number} galaAmount - GALA amount (must be exactly 500)
 * @returns {Promise<Object>} - EggNFT object
 */
export async function mintEgg(provider, ownerAddress, faction, galaAmount = 500) {
  try {
    if (!provider) {
      throw new Error('Wallet provider is required');
    }
    if (!ownerAddress) {
      throw new Error('Owner address is required');
    }
    
    // Normalize the owner address - strip prefix if present, we'll add it back for DTO
    const normalizedOwnerAddress = stripAddressPrefix(ownerAddress);
    
    // Get the actual provider (window.ethereum) if provider is BrowserConnectClient
    let ethereumProvider = provider;
    if (provider._provider) {
      ethereumProvider = provider._provider;
    } else if (typeof window !== "undefined" && window.ethereum) {
      ethereumProvider = window.ethereum;
    }
    
    // Ensure provider doesn't have any cached address with prefix
    // Get fresh account from provider to avoid any cached state
    let freshAccount = normalizedOwnerAddress;
    try {
      if (ethereumProvider && ethereumProvider.request) {
        const accounts = await ethereumProvider.request({ method: 'eth_accounts' });
        if (Array.isArray(accounts) && accounts.length > 0) {
          freshAccount = stripAddressPrefix(accounts[0]);
        }
      }
    } catch (e) {
      // Use the provided address if we can't get fresh account
      console.warn('Could not get fresh account from provider, using provided address:', e);
    }
    
    // Normalize faction to match contract enum
    const normalizedFaction = normalizeFaction(faction);
    
    // Validate galaAmount
    const galaAmountNumber = Number(galaAmount);
    if (isNaN(galaAmountNumber) || galaAmountNumber <= 0) {
      throw new Error(`Invalid galaAmount: ${galaAmount}. Must be a positive number`);
    }
    
    const wallet = await getGalaChainClient(ethereumProvider);
    const eggContract = wallet.forContract(CONTRACT_IDS.EGG);
    
    const dto = {
      ownerAddress: formatAddress(freshAccount), // Add prefix for GalaChain DTO
      faction: normalizedFaction,
      galaAmount: galaAmountNumber,
      uniqueKey: randomUniqueKey()
    };
    
    console.log("MintEgg DTO:", dto);
    
    // Call the contract method
    const response = await eggContract.MintByUser(dto);
    console.log("-------------------------------------response", response);
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to mint egg');
    }

    return response.Data;
  } catch (error) {
    console.error('Mint egg error:', error);
    throw error;
  }
}

async function checkRegistration(address) {
  const response = await fetch(`${GALA_CHAIN_API_URL}/${CONTRACT_IDS.PUBLICKEY}/GetPublicKey`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: address })
    }
  )
  if (!response.ok) return false;
  return true;
}

/**
 * Mint 4 eggs at once (multi-mint)
 * @param {Object} provider - Gala wallet provider
 * @param {string} ownerAddress - Owner's wallet address
 * @param {number} galaAmount - GALA amount (must be exactly 2000)
 * @returns {Promise<Array>} - Array of EggNFT objects
 */
export async function multiMintEggs(provider, ownerAddress, galaAmount = 2000) {
  try {
    const client = await getGalaChainClient(provider);
    const eggContract = client.forContract(CONTRACT_IDS.EGG);
    
    const dto = {
      ownerAddress: formatAddress(ownerAddress),
      galaAmount: galaAmount,
      uniqueKey: randomUniqueKey()
    };

    const response = await eggContract.MultiMint(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to multi-mint eggs');
    }

    return response.Data;
  } catch (error) {
    console.error('Multi-mint eggs error:', error);
    throw error;
  }
}

/**
 * Get a single egg by ID
 * @param {Object} provider - Gala wallet provider
 * @param {string} eggId - Egg ID
 * @returns {Promise<Object>} - EggNFT object
 */
export async function getEgg(provider, eggId) {
  try {
    const client = await getGalaChainClient(provider);
    const eggContract = client.forContract(CONTRACT_IDS.EGG);
    
    const dto = {
      id: eggId,
      uniqueKey: randomUniqueKey()
    };

    const response = await eggContract.GetEgg(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Egg not found');
    }

    return response.Data;
  } catch (error) {
    console.error('Get egg error:', error);
    throw error;
  }
}

/**
 * Get all eggs owned by an address
 * @param {Object} provider - Gala wallet provider
 * @param {string} ownerAddress - Owner's wallet address
 * @param {Object} filters - Optional filters { faction, rarity, isHatched, isIncubating }
 * @returns {Promise<Array>} - Array of EggNFT objects
 */
export async function getEggsByOwner(provider, ownerAddress, filters = {}) {
  try {
    const client = await getGalaChainClient(provider);
    const eggContract = client.forContract(CONTRACT_IDS.EGG);
    
    const dto = {
      ownerAddress: formatAddress(ownerAddress),
      uniqueKey: randomUniqueKey(),
      ...filters
    };

    const response = await eggContract.GetEggsByOwner(dto);
    
    if (response.Status === 0) {
      // Return empty array if no eggs found
      return [];
    }

    return response.Data || [];
  } catch (error) {
    console.error('Get eggs by owner error:', error);
    throw error;
  }
}

/**
 * Transfer an egg to another address
 * @param {Object} provider - Gala wallet provider
 * @param {string} eggId - Egg ID
 * @param {string} fromAddress - Current owner's address
 * @param {string} toAddress - Recipient's address
 * @returns {Promise<Object>} - Updated EggNFT object
 */
export async function transferEgg(provider, eggId, fromAddress, toAddress) {
  try {
    const client = await getGalaChainClient(provider);
    const eggContract = client.forContract(CONTRACT_IDS.EGG);
    
    const dto = {
      id: eggId,
      from: formatAddress(fromAddress),
      to: formatAddress(toAddress),
      uniqueKey: randomUniqueKey()
    };

    const response = await eggContract.Transfer(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to transfer egg');
    }

    return response.Data;
  } catch (error) {
    console.error('Transfer egg error:', error);
    throw error;
  }
}

/**
 * Burn an egg (permanently delete)
 * @param {Object} provider - Gala wallet provider
 * @param {string} eggId - Egg ID
 * @returns {Promise<string>} - Burned egg ID
 */
export async function burnEgg(provider, eggId) {
  try {
    const client = await getGalaChainClient(provider);
    const eggContract = client.forContract(CONTRACT_IDS.EGG);
    
    const dto = {
      id: eggId,
      uniqueKey: randomUniqueKey()
    };

    const response = await eggContract.BurnEgg(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to burn egg');
    }

    return response.Data;
  } catch (error) {
    console.error('Burn egg error:', error);
    throw error;
  }
}

/**
 * ============================================
 * INCUBATOR CONTRACT METHODS
 * ============================================
 */

/**
 * Start incubating an egg
 * @param {Object} provider - Gala wallet provider
 * @param {string} userId - User's wallet address
 * @param {string} eggId - Egg ID to incubate
 * @returns {Promise<Object>} - { sessionId, endTime, durationHours }
 */
export async function startIncubation(provider, userId, eggId) {
  try {
    const client = await getGalaChainClient(provider);
    const incubatorContract = client.forContract(CONTRACT_IDS.INCUBATOR);
    
    const dto = {
      userId: formatAddress(userId),
      eggId: eggId,
      uniqueKey: randomUniqueKey()
    };

    const response = await incubatorContract.StartIncubation(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to start incubation');
    }

    return response.Data;
  } catch (error) {
    console.error('Start incubation error:', error);
    throw error;
  }
}

/**
 * Speed up incubation
 * @param {Object} provider - Gala wallet provider
 * @param {string} sessionId - Incubation session ID
 * @param {string} tier - Speed-up tier (TIER_1, TIER_2, TIER_3)
 * @param {string} galaTokenInstance - GALA token instance key
 * @returns {Promise<Object>} - { hoursReduced, newEndTime, remainingHours }
 */
export async function speedUpIncubation(provider, sessionId, tier, galaTokenInstance) {
  try {
    const client = await getGalaChainClient(provider);
    const incubatorContract = client.forContract(CONTRACT_IDS.INCUBATOR);
    
    const dto = {
      sessionId: sessionId,
      tier: tier,
      galaTokenInstance: galaTokenInstance,
      uniqueKey: randomUniqueKey()
    };

    const response = await incubatorContract.SpeedUpIncubation(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to speed up incubation');
    }

    return response.Data;
  } catch (error) {
    console.error('Speed up incubation error:', error);
    throw error;
  }
}

/**
 * Claim creature after incubation completes
 * @param {Object} provider - Gala wallet provider
 * @param {string} sessionId - Incubation session ID
 * @returns {Promise<Object>} - { creatureTokenInstance }
 */
export async function claimCreature(provider, sessionId) {
  try {
    const client = await getGalaChainClient(provider);
    const incubatorContract = client.forContract(CONTRACT_IDS.INCUBATOR);
    
    const dto = {
      sessionId: sessionId,
      uniqueKey: randomUniqueKey()
    };

    const response = await incubatorContract.ClaimCreature(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to claim creature');
    }

    return response.Data;
  } catch (error) {
    console.error('Claim creature error:', error);
    throw error;
  }
}

/**
 * Get incubation status
 * @param {Object} provider - Gala wallet provider
 * @param {string} sessionId - Incubation session ID
 * @returns {Promise<Object>} - IncubationSession object
 */
export async function getIncubationStatus(provider, sessionId) {
  try {
    const client = await getGalaChainClient(provider);
    const incubatorContract = client.forContract(CONTRACT_IDS.INCUBATOR);
    
    const dto = {
      sessionId: sessionId,
      uniqueKey: randomUniqueKey()
    };

    const response = await incubatorContract.GetIncubationStatus(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Incubation session not found');
    }

    return response.Data;
  } catch (error) {
    console.error('Get incubation status error:', error);
    throw error;
  }
}

/**
 * Get all active incubations for a user
 * @param {Object} provider - Gala wallet provider
 * @param {string} userId - User's wallet address
 * @returns {Promise<Array>} - Array of IncubationSession objects
 */
export async function getUserIncubations(provider, userId) {
  try {
    const client = await getGalaChainClient(provider);
    const incubatorContract = client.forContract(CONTRACT_IDS.INCUBATOR);
    
    const dto = {
      userId: formatAddress(userId),
      uniqueKey: randomUniqueKey()
    };

    const response = await incubatorContract.GetUserIncubations(dto);
    
    if (response.Status === 0) {
      return [];
    }

    return response.Data || [];
  } catch (error) {
    console.error('Get user incubations error:', error);
    throw error;
  }
}

/**
 * ============================================
 * CREATURE CONTRACT METHODS
 * ============================================
 */

/**
 * Mint a baby creature from a hatched egg
 * @param {Object} provider - Gala wallet provider
 * @param {string} ownerAddress - Owner's wallet address
 * @param {string} eggId - Hatched egg ID
 * @param {number} galaAmount - GALA amount
 * @param {number} soulAmount - SOUL amount
 * @param {string} galaTokenInstance - GALA token instance key
 * @param {string} soulTokenInstance - SOUL token instance key
 * @returns {Promise<Object>} - CreatureNFT object
 */
export async function mintBabyCreature(provider, ownerAddress, eggId, galaAmount, soulAmount, galaTokenInstance, soulTokenInstance) {
  try {
    const client = await getGalaChainClient(provider);
    const creatureContract = client.forContract(CONTRACT_IDS.CREATURE);
    
    const dto = {
      ownerAddress: formatAddress(ownerAddress),
      eggId: eggId,
      galaAmount: galaAmount,
      soulAmount: soulAmount,
      galaTokenInstance: galaTokenInstance,
      soulTokenInstance: soulTokenInstance,
      uniqueKey: randomUniqueKey()
    };

    const response = await creatureContract.MintBaby(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to mint baby creature');
    }

    return response.Data;
  } catch (error) {
    console.error('Mint baby creature error:', error);
    throw error;
  }
}

/**
 * Evolve two creatures to create a new one
 * @param {Object} provider - Gala wallet provider
 * @param {string} ownerAddress - Owner's wallet address
 * @param {string} parentCreatureIdA - First parent creature ID
 * @param {string} parentCreatureIdB - Second parent creature ID
 * @param {number} galaAmount - GALA amount
 * @param {number} soulAmount - SOUL amount
 * @param {string} galaTokenInstance - GALA token instance key
 * @param {string} soulTokenInstance - SOUL token instance key
 * @returns {Promise<Object>} - New CreatureNFT object
 */
export async function evolveCreatures(provider, ownerAddress, parentCreatureIdA, parentCreatureIdB, galaAmount, soulAmount, galaTokenInstance, soulTokenInstance) {
  try {
    const client = await getGalaChainClient(provider);
    const creatureContract = client.forContract(CONTRACT_IDS.CREATURE);
    
    const dto = {
      ownerAddress: formatAddress(ownerAddress),
      parentCreatureIdA: parentCreatureIdA,
      parentCreatureIdB: parentCreatureIdB,
      galaAmount: galaAmount,
      soulAmount: soulAmount,
      galaTokenInstance: galaTokenInstance,
      soulTokenInstance: soulTokenInstance,
      uniqueKey: randomUniqueKey()
    };

    const response = await creatureContract.Evolve(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to evolve creatures');
    }

    return response.Data;
  } catch (error) {
    console.error('Evolve creatures error:', error);
    throw error;
  }
}

/**
 * Mint an egg from two adult creatures (breeding)
 * @param {Object} provider - Gala wallet provider
 * @param {string} ownerAddress - Owner's wallet address
 * @param {string} parentCreatureIdA - First parent creature ID
 * @param {string} parentCreatureIdB - Second parent creature ID
 * @param {number} galaAmount - GALA amount
 * @param {number} soulAmount - SOUL amount
 * @param {string} galaTokenInstance - GALA token instance key
 * @param {string} soulTokenInstance - SOUL token instance key
 * @returns {Promise<Object>} - New EggNFT object
 */
export async function mintEggFromCreatures(provider, ownerAddress, parentCreatureIdA, parentCreatureIdB, galaAmount, soulAmount, galaTokenInstance, soulTokenInstance) {
  try {
    const client = await getGalaChainClient(provider);
    const creatureContract = client.forContract(CONTRACT_IDS.CREATURE);
    
    const dto = {
      ownerAddress: formatAddress(ownerAddress),
      parentCreatureIdA: parentCreatureIdA,
      parentCreatureIdB: parentCreatureIdB,
      galaAmount: galaAmount,
      soulAmount: soulAmount,
      galaTokenInstance: galaTokenInstance,
      soulTokenInstance: soulTokenInstance,
      uniqueKey: randomUniqueKey()
    };

    const response = await creatureContract.MintEggFromCreatures(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to mint egg from creatures');
    }

    return response.Data;
  } catch (error) {
    console.error('Mint egg from creatures error:', error);
    throw error;
  }
}

/**
 * Get a creature by ID
 * @param {Object} provider - Gala wallet provider
 * @param {string} creatureId - Creature ID
 * @returns {Promise<Object>} - CreatureNFT object
 */
export async function getCreature(provider, creatureId) {
  try {
    const client = await getGalaChainClient(provider);
    const creatureContract = client.forContract(CONTRACT_IDS.CREATURE);
    
    const dto = {
      id: creatureId,
      uniqueKey: randomUniqueKey()
    };

    const response = await creatureContract.GetCreature(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Creature not found');
    }

    return response.Data;
  } catch (error) {
    console.error('Get creature error:', error);
    throw error;
  }
}

/**
 * Get all creatures owned by an address
 * @param {Object} provider - Gala wallet provider
 * @param {string} ownerAddress - Owner's wallet address
 * @param {Object} filters - Optional filters { faction, rarity, generation }
 * @returns {Promise<Array>} - Array of CreatureNFT objects
 */
export async function getCreaturesByOwner(provider, ownerAddress, filters = {}) {
  try {
    const client = await getGalaChainClient(provider);
    const creatureContract = client.forContract(CONTRACT_IDS.CREATURE);
    
    const dto = {
      ownerAddress: formatAddress(ownerAddress),
      uniqueKey: randomUniqueKey(),
      ...filters
    };

    const response = await creatureContract.GetCreaturesByOwner(dto);
    
    if (response.Status === 0) {
      return [];
    }

    return response.Data || [];
  } catch (error) {
    console.error('Get creatures by owner error:', error);
    throw error;
  }
}

/**
 * Transfer a creature to another address
 * @param {Object} provider - Gala wallet provider
 * @param {string} creatureId - Creature ID
 * @param {string} fromAddress - Current owner's address
 * @param {string} toAddress - Recipient's address
 * @returns {Promise<Object>} - Updated CreatureNFT object
 */
export async function transferCreature(provider, creatureId, fromAddress, toAddress) {
  try {
    const client = await getGalaChainClient(provider);
    const creatureContract = client.forContract(CONTRACT_IDS.CREATURE);
    
    const dto = {
      id: creatureId,
      from: formatAddress(fromAddress),
      to: formatAddress(toAddress),
      uniqueKey: randomUniqueKey()
    };

    const response = await creatureContract.Transfer(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to transfer creature');
    }

    return response.Data;
  } catch (error) {
    console.error('Transfer creature error:', error);
    throw error;
  }
}

/**
 * ============================================
 * SOUL CONTRACT METHODS
 * ============================================
 */

/**
 * Buy SOUL tokens with GALA
 * @param {Object} provider - Gala wallet provider
 * @param {string} buyerAddress - Buyer's wallet address
 * @param {number} galaAmount - GALA amount to spend
 * @param {string} galaTokenInstance - GALA token instance key
 * @returns {Promise<Object>} - { soulAmount, galaPooled, galaToAdmin }
 */
export async function buySoulWithGala(provider, buyerAddress, galaAmount, galaTokenInstance) {
  try {
    const client = await getGalaChainClient(provider);
    const soulContract = client.forContract(CONTRACT_IDS.SOUL);
    
    const dto = {
      buyerAddress: formatAddress(buyerAddress),
      galaAmount: galaAmount,
      galaTokenInstance: galaTokenInstance,
      uniqueKey: randomUniqueKey()
    };

    const response = await soulContract.BuySoulWithGala(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to buy SOUL tokens');
    }

    return response.Data;
  } catch (error) {
    console.error('Buy SOUL with GALA error:', error);
    throw error;
  }
}

/**
 * Get SOUL amount for a given GALA amount (view function)
 * @param {Object} provider - Gala wallet provider
 * @param {number} galaAmount - GALA amount
 * @returns {Promise<number>} - SOUL amount
 */
export async function getSoulAmount(provider, galaAmount) {
  try {
    const client = await getGalaChainClient(provider);
    const soulContract = client.forContract(CONTRACT_IDS.SOUL);
    
    const dto = {
      galaAmount: galaAmount,
      uniqueKey: randomUniqueKey()
    };

    const response = await soulContract.GetSoulAmount(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to get SOUL amount');
    }

    return response.Data;
  } catch (error) {
    console.error('Get SOUL amount error:', error);
    throw error;
  }
}

/**
 * Get current exchange rate (GALA per SOUL)
 * @param {Object} provider - Gala wallet provider
 * @returns {Promise<number>} - Exchange rate
 */
export async function getCurrentExchangeRate(provider) {
  try {
    const client = await getGalaChainClient(provider);
    const soulContract = client.forContract(CONTRACT_IDS.SOUL);
    
    const dto = {
      uniqueKey: randomUniqueKey()
    };

    const response = await soulContract.GetCurrentRate(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to get exchange rate');
    }

    return response.Data;
  } catch (error) {
    console.error('Get exchange rate error:', error);
    throw error;
  }
}

/**
 * ============================================
 * PUBLICKEY CONTRACT METHODS
 * ============================================
 */

/**
 * Check if a wallet is registered with PUBLICKEYCONTRACT
 * Uses GetProfile which requires the user to be connected and signed
 * @param {Object} provider - Gala wallet provider
 * @param {string} walletAddress - Wallet address to check
 * @returns {Promise<Object|null>} - User profile if registered, null if not registered
 */
export async function checkWalletRegistration(provider, walletAddress) {
  try {
    const client = await getGalaChainClient(provider);
    const publicKeyContract = client.forContract(CONTRACT_IDS.PUBLICKEY);
    
    // GetProfile (GetMyProfile) requires signing with the user's private key
    // The DTO will be automatically signed by the wallet provider
    const dto = {
      uniqueKey: randomUniqueKey()
    };

    const response = await publicKeyContract.GetProfile(dto);
    
    // If Status is 0, user is not registered or there was an error
    if (response.Status === 0) {
      // Check if the error message indicates user not found
      if (response.Message && (
        response.Message.includes('not found') || 
        response.Message.includes('does not exist') ||
        response.Message.includes('not registered')
      )) {
        return null;
      }
      // Other errors should be thrown
      throw new Error(response.Message || 'Failed to check wallet registration');
    }

    return response.Data;
  } catch (error) {
    // If error indicates user not found or not registered, return null
    const errorMessage = error.message || error.Message || '';
    if (errorMessage.includes('not found') || 
        errorMessage.includes('does not exist') ||
        errorMessage.includes('not registered') ||
        errorMessage.includes('Profile not found')) {
      return null;
    }
    // Re-throw other errors
    console.error('Check wallet registration error:', error);
    throw error;
  }
}

/**
 * Register a wallet with PUBLICKEYCONTRACT
 * Note: This requires the public key, which should be obtained from the wallet
 * @param {Object} provider - Gala wallet provider
 * @param {string} walletAddress - Wallet address to register
 * @param {string} publicKey - Public key (secp256k1) in hex or base64 format
 * @returns {Promise<string>} - Identity key (alias) of the registered user
 */
export async function registerWallet(provider, walletAddress, publicKey) {
  try {
    const client = await getGalaChainClient(provider);
    const publicKeyContract = client.forContract(CONTRACT_IDS.PUBLICKEY);
    
    const dto = {
      publicKey: publicKey,
      uniqueKey: randomUniqueKey()
    };

    const response = await publicKeyContract.RegisterEthUser(dto);
    
    if (response.Status === 0) {
      throw new Error(response.Message || 'Failed to register wallet');
    }

    return response.Data; // Returns the identity key (alias)
  } catch (error) {
    console.error('Register wallet error:', error);
    throw error;
  }
}

/**
 * ============================================
 * EXPORT ALL METHODS
 * ============================================
 */

export default {
  // Egg Contract
  mintEgg,
  multiMintEggs,
  getEgg,
  getEggsByOwner,
  transferEgg,
  burnEgg,
  
  // Incubator Contract
  startIncubation,
  speedUpIncubation,
  claimCreature,
  getIncubationStatus,
  getUserIncubations,
  
  // Creature Contract
  mintBabyCreature,
  evolveCreatures,
  mintEggFromCreatures,
  getCreature,
  getCreaturesByOwner,
  transferCreature,
  
  // Soul Contract
  buySoulWithGala,
  getSoulAmount,
  getCurrentExchangeRate,
  
  // PublicKey Contract
  checkWalletRegistration,
  registerWallet,
  
  // Constants
  FACTIONS,
  RARITY,
  SPEED_UP_TIERS
};

