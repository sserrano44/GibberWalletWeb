# GibberWeb - Sound-Based Airgap Wallet Web Client

A Next.js web application that serves as the online client for the GibberWallet sound-based airgap wallet system. This application enables secure transaction signing using audio transmission instead of QR codes.

## Features

- **Sound-Based Communication**: Uses ggwave library for audio data transmission
- **Ethereum Support**: Send ETH and ERC-20 tokens
- **Real-time Audio**: Web Audio API for browser-based sound processing
- **Responsive Design**: Clean, modern UI with Tailwind CSS
- **TypeScript**: Full type safety throughout the application

## Architecture

### Core Components

- **WalletClient**: Main orchestrator for wallet operations and audio communication
- **AudioProtocol**: Web Audio API implementation for sound transmission/reception
- **MessageProtocol**: EIP-compliant message format for wallet communication
- **CryptoUtils**: Ethereum transaction utilities (browser-compatible)

### React Components

- **WalletConnect**: Network configuration and balance display
- **TransactionForm**: ETH and ERC-20 transaction creation
- **AudioControls**: Audio system management
- **StatusDisplay**: Connection and audio status indicators

## Prerequisites

- Node.js 18+
- Modern web browser with Web Audio API support
- Microphone and speaker access for audio communication
- Running offline wallet (from NodePoC directory)

## Installation

```bash
cd gibberweb
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Setup

1. **Configure Network**: Enter RPC URL, Chain ID, and wallet address
2. **Connect**: Initialize connection to Ethereum network
3. **Enable Audio**: Grant microphone permissions and start listening

### Sending Transactions

1. **Fill Transaction Details**: Choose ETH or ERC-20 transfer and enter recipient/amount
2. **Start Audio Listening**: Ensure both devices can hear each other
3. **Send Transaction**: Click send to initiate the audio-based transaction flow
4. **Approve on Offline Wallet**: Confirm the transaction on your airgap device
5. **Automatic Broadcast**: Signed transaction is received and broadcast to the network

## Audio Protocol Flow

1. **Ping/Pong Handshake**: Establish communication with offline wallet
2. **Transaction Request**: Send transaction details via sound
3. **User Confirmation**: Offline wallet displays transaction for approval
4. **Signed Response**: Receive signed transaction via sound
5. **Network Broadcast**: Submit transaction to Ethereum network

## Configuration

### Network Presets

- **Sepolia Testnet**: Chain ID 11155111
- **Ethereum Mainnet**: Chain ID 1
- **Polygon**: Chain ID 137

### Audio Settings

- **Protocol**: AUDIBLE_FAST (ggwave)
- **Volume**: 15 (optimized for cross-device transmission)
- **Sample Rate**: 48kHz

## Security Considerations

- **Airgap Isolation**: Private keys never leave the offline device
- **Sound Range**: Limited to short-range communication (1-2 meters)
- **No Network Access**: Offline wallet has no internet connectivity
- **User Confirmation**: All transactions require manual approval

## File Structure

```
gibberweb/
├── src/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   ├── lib/                # Core library modules
│   ├── types/              # TypeScript type definitions
│   └── public/             # Static assets (ggwave.js)
├── package.json
└── README.md
```

## Integration

This web client integrates with:

- **NodePoC Offline Wallet**: The airgap signing device
- **Ethereum Networks**: Any EVM-compatible blockchain
- **ggwave Protocol**: Cross-platform audio data transmission

## Troubleshooting

### Audio Issues
- Ensure microphone permissions are granted
- Check device volume levels
- Minimize background noise
- Keep devices 1-2 meters apart

### Connection Issues
- Verify RPC URL is accessible
- Check network connectivity
- Confirm chain ID matches network

### Transaction Failures
- Ensure sufficient balance for gas fees
- Verify recipient address format
- Check offline wallet is listening

## Development Notes

- ESLint rules disabled for demo purposes
- TypeScript strict mode with some `any` types for ggwave integration
- Web Audio API requires HTTPS in production
- ggwave.js must be served from public directory

## Next Steps

1. Test end-to-end integration with offline wallet
2. Add transaction history and receipt display
3. Implement additional token standards (ERC-721, etc.)
4. Add multi-signature wallet support
5. Enhance audio protocol error handling
