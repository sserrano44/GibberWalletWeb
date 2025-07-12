export interface NetworkConfig {
  id: string;
  name: string;
  rpcUrl: string;
  chainId: number;
  isCustom: boolean;
}

export interface PresetNetwork extends Omit<NetworkConfig, 'id' | 'isCustom'> {
  isCustom: false;
}

export interface CustomNetwork extends NetworkConfig {
  isCustom: true;
}

const STORAGE_KEY = 'gibberwallet_custom_networks';

// Preset networks with LlamaNodes RPCs
export const PRESET_NETWORKS: PresetNetwork[] = [
  {
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    chainId: 1,
    isCustom: false,
  },
  {
    name: 'Base',
    rpcUrl: 'https://base.llamarpc.com',
    chainId: 8453,
    isCustom: false,
  },
  {
    name: 'Binance Smart Chain',
    rpcUrl: 'https://binance.llamarpc.com',
    chainId: 56,
    isCustom: false,
  },
];

/**
 * Generate a unique ID for custom networks
 */
function generateNetworkId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get custom networks from localStorage
 */
export function getCustomNetworks(): CustomNetwork[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const networks = JSON.parse(stored);
    return Array.isArray(networks) ? networks : [];
  } catch (error) {
    console.error('Failed to load custom networks:', error);
    return [];
  }
}

/**
 * Save custom networks to localStorage
 */
function saveCustomNetworks(networks: CustomNetwork[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(networks));
  } catch (error) {
    console.error('Failed to save custom networks:', error);
    throw new Error('Failed to save network configuration');
  }
}

/**
 * Get all networks (preset + custom)
 */
export function getAllNetworks(): NetworkConfig[] {
  const presetNetworks: NetworkConfig[] = PRESET_NETWORKS.map(network => ({
    ...network,
    id: `preset_${network.chainId}`,
    isCustom: false,
  }));
  
  const customNetworks = getCustomNetworks();
  
  return [...presetNetworks, ...customNetworks];
}

/**
 * Add a new custom network
 */
export function addCustomNetwork(
  name: string,
  rpcUrl: string,
  chainId: number
): CustomNetwork {
  const networks = getCustomNetworks();
  
  // Validate inputs
  if (!name.trim()) {
    throw new Error('Network name is required');
  }
  
  if (!rpcUrl.trim()) {
    throw new Error('RPC URL is required');
  }
  
  if (!rpcUrl.startsWith('https://') && !rpcUrl.startsWith('http://')) {
    throw new Error('RPC URL must be a valid HTTP/HTTPS URL');
  }
  
  if (chainId <= 0 || !Number.isInteger(chainId)) {
    throw new Error('Chain ID must be a positive integer');
  }
  
  // Check for duplicates
  const allNetworks = getAllNetworks();
  
  const existingByChainId = allNetworks.find(n => n.chainId === chainId);
  if (existingByChainId) {
    throw new Error(`A network with Chain ID ${chainId} already exists: ${existingByChainId.name}`);
  }
  
  const existingByName = allNetworks.find(n => n.name.toLowerCase() === name.toLowerCase());
  if (existingByName) {
    throw new Error(`A network with name "${name}" already exists`);
  }
  
  const newNetwork: CustomNetwork = {
    id: generateNetworkId(),
    name: name.trim(),
    rpcUrl: rpcUrl.trim(),
    chainId,
    isCustom: true,
  };
  
  const updatedNetworks = [...networks, newNetwork];
  saveCustomNetworks(updatedNetworks);
  
  return newNetwork;
}

/**
 * Update an existing custom network
 */
export function updateCustomNetwork(
  id: string,
  name: string,
  rpcUrl: string,
  chainId: number
): CustomNetwork {
  const networks = getCustomNetworks();
  const networkIndex = networks.findIndex(n => n.id === id);
  
  if (networkIndex === -1) {
    throw new Error('Network not found');
  }
  
  // Validate inputs (same as addCustomNetwork)
  if (!name.trim()) {
    throw new Error('Network name is required');
  }
  
  if (!rpcUrl.trim()) {
    throw new Error('RPC URL is required');
  }
  
  if (!rpcUrl.startsWith('https://') && !rpcUrl.startsWith('http://')) {
    throw new Error('RPC URL must be a valid HTTP/HTTPS URL');
  }
  
  if (chainId <= 0 || !Number.isInteger(chainId)) {
    throw new Error('Chain ID must be a positive integer');
  }
  
  // Check for duplicates (excluding the current network)
  const allNetworks = getAllNetworks().filter(n => n.id !== id);
  
  const existingByChainId = allNetworks.find(n => n.chainId === chainId);
  if (existingByChainId) {
    throw new Error(`A network with Chain ID ${chainId} already exists: ${existingByChainId.name}`);
  }
  
  const existingByName = allNetworks.find(n => n.name.toLowerCase() === name.toLowerCase());
  if (existingByName) {
    throw new Error(`A network with name "${name}" already exists`);
  }
  
  const updatedNetwork: CustomNetwork = {
    id,
    name: name.trim(),
    rpcUrl: rpcUrl.trim(),
    chainId,
    isCustom: true,
  };
  
  networks[networkIndex] = updatedNetwork;
  saveCustomNetworks(networks);
  
  return updatedNetwork;
}

/**
 * Delete a custom network
 */
export function deleteCustomNetwork(id: string): void {
  const networks = getCustomNetworks();
  const filteredNetworks = networks.filter(n => n.id !== id);
  
  if (filteredNetworks.length === networks.length) {
    throw new Error('Network not found');
  }
  
  saveCustomNetworks(filteredNetworks);
}

/**
 * Find a network by ID
 */
export function findNetworkById(id: string): NetworkConfig | undefined {
  return getAllNetworks().find(n => n.id === id);
}

/**
 * Find a network by chain ID
 */
export function findNetworkByChainId(chainId: number): NetworkConfig | undefined {
  return getAllNetworks().find(n => n.chainId === chainId);
}

/**
 * Clear all custom networks (for testing/reset purposes)
 */
export function clearCustomNetworks(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear custom networks:', error);
  }
}