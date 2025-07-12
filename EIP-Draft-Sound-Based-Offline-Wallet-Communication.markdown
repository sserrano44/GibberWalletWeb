# EIP: Sound-based Communication for Offline Wallets

## Preamble

- **EIP Number:** [To be assigned]
- **Title:** Sound-based Communication for Offline Wallets
- **Author:** [Your Name or Pseudonym]
- **Status:** Draft
- **Type:** Standards Track
- **Category:** Interface
- **Created:** 2025-07-04
- **Requires:** None

## Abstract

This EIP proposes a standardized protocol for bidirectional communication between an online device and an offline Ethereum wallet using sound waves. The protocol enables an offline wallet to receive transaction requests, process them, and send back signed transactions or acknowledgments via sound. It utilizes the ggwave library (or compatible sound modulation libraries) to encode and decode data into audio signals, providing a contactless and widely accessible method for secure offline wallet interactions.

## Motivation

Offline wallets, such as hardware wallets or air-gapped software wallets, enhance security by isolating private keys from internet-connected devices. However, interacting with these wallets often requires physical connections (e.g., USB) or visual methods (e.g., QR codes), which may be inconvenient or impractical. Sound-based communication offers a contactless alternative that leverages ubiquitous audio hardware, eliminating the need for specialized peripherals. This EIP standardizes this approach, ensuring interoperability and improving user experience for offline Ethereum transactions.

## Specification

### Message Format

Messages are JSON-encoded objects with the following fields:

- **`version`**: A string indicating the protocol version (e.g., `"1.0"`, `"2.0"`). This allows implementations to support multiple protocol versions and ensures backwards compatibility. The initial version is `"1.0"`.
- **`type`**: A string indicating the message type. Supported types include:
  - `"connect"`: Initiates communication from the online device and requests wallet address.
  - `"connect_response"`: Response from the offline wallet containing wallet address.
  - `"tx_request"`: Transaction request from the online device.
  - `"tx_response"`: Signed transaction response from the offline wallet.
  - `"ack"`: General acknowledgment of message receipt.
  - `"error"`: Indicates an error condition.
  - `"chunk"`: Part of a chunked message for handling large payloads.
- **`payload`**: The data specific to the message type (see below for details).
- **`id`**: A unique string identifier for the message, used to correlate requests and responses. To minimize message size, implementations should use shortened UUID formats (e.g., short-uuid library) rather than standard 36-character UUIDs.

#### Payload Examples

- **For `connect`:**
  ```json
  {
    "version": "1.0",
    "type": "connect",
    "payload": {},
    "id": "12345"
  }
  ```

- **For `connect_response`:**
  ```json
  {
    "version": "1.0",
    "type": "connect_response",
    "payload": {
      "address": "0x742d35cc6bf8c3f2e4e4fd7a3f1b4c6e7d8e9f0a",
      "received_id": "12345"
    },
    "id": "67890"
  }
  ```

- **For `tx_request`:**
  ```json
  {
    "version": "1.0",
    "type": "tx_request",
    "payload": {
      "transaction": {
        "chainId": 1,
        "nonce": "0x0",
        "gasPrice": "0x09184e72a000",
        "gasLimit": "0x2710",
        "to": "0x0000000000000000000000000000000000000000",
        "value": "0x00",
        "data": "0x"
      }
    },
    "id": "12345"
  }
  ```

- **For `tx_response`:**
  ```json
  {
    "version": "1.0",
    "type": "tx_response",
    "payload": {
      "signedTransaction": {
        "raw": "0xf86c018609184e72a0008227109400000000000000000000000000000000000000000080801ca0...",
        "hash": "0x9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c9c6c445836d8b"
      }
    },
    "id": "12345"
  }
  ```

- **For `ack`:**
  ```json
  {
    "version": "1.0",
    "type": "ack",
    "payload": {
      "received_id": "12345"
    },
    "id": "67890"
  }
  ```

- **For `error`:**
  ```json
  {
    "version": "1.0",
    "type": "error",
    "payload": {
      "message": "Invalid transaction data"
    },
    "id": "12345"
  }
  ```

- **For `chunk`:**
  ```json
  {
    "version": "1.0",
    "type": "chunk",
    "payload": {
      "originalMessageId": "original-msg-id",
      "originalType": "connect_response",
      "chunkIndex": 0,
      "totalChunks": 3,
      "chunkData": "{\"version\":\"1.0\",\"type\":\"connect_response\",\"payload\":{\"address\""
    },
    "id": "chunk-id-1"
  }
  ```

### Versioning

- **Purpose:** The `version` field ensures that devices can identify and process messages according to the correct protocol version.
- **Format:** Semantic versioning (e.g., `"1.0"`, `"1.1"`, `"2.0"`). Major version increments indicate breaking changes; minor versions add backwards-compatible features.
- **Handling Mismatches:**
  - If the receiver does not support the message's version, it responds with an `error` message using the highest supported version, e.g.:
    ```json
    {
      "version": "1.0",
      "type": "error",
      "payload": {
        "message": "Unsupported protocol version: 2.0"
      },
      "id": "12345"
    }
    ```
  - Implementations must support at least version `"1.0"` as defined in this EIP.

### Message Chunking

Due to the 140-byte limitation of ggwave protocols, messages that exceed this limit must be split into smaller chunks for transmission.

- **Chunking Threshold:** Messages longer than 120 bytes should be chunked (providing a safety margin).
- **Chunk Size:** Each chunk should contain no more than 80 bytes of data to ensure reliable transmission.
- **Chunk Format:** Chunks are sent as `"chunk"` message types with the following payload structure:
  - `originalMessageId`: The ID of the original message being chunked
  - `originalType`: The type of the original message (e.g., `"connect_response"`)
  - `chunkIndex`: Zero-based index of this chunk (0, 1, 2, ...)
  - `totalChunks`: Total number of chunks for this message
  - `chunkData`: The actual data fragment for this chunk

- **Transmission:** Chunks must be sent sequentially, waiting for each chunk transmission to fully complete before starting the next one. A 1-second buffer delay should be added between completed chunks to ensure reliable reception and avoid audio overlap.
- **Reassembly:** The receiver collects all chunks and reconstructs the original message by:
  1. Collecting chunks with the same `originalMessageId`
  2. Sorting chunks by `chunkIndex`
  3. Verifying all chunks are received (`chunks.length === totalChunks`)
  4. Concatenating `chunkData` from all chunks in order
  5. Parsing the reconstructed JSON as the original message

- **Audio Isolation:** During chunk transmission, the sending device should completely stop audio listening to prevent interference from hearing its own transmission. Audio listening should be restarted after all chunks are sent with a 2-second buffer period.
- **Error Handling:** If chunk reassembly fails or times out, the receiver should discard partial chunks and may request retransmission.

### Sound Encoding

- **Library:** Data is encoded into sound waves using the ggwave library or a compatible alternative.
- **Parameters:**
  - **Protocol:** Use ggwave's "Fast" protocol (ID: 1) for audible frequencies to ensure optimal speed while maintaining reliability. Alternative protocols such as "Normal" (ID: 0) may be used but all implementations should use the same protocol for compatibility.
  - **Sample Rate:** 44100 Hz.
  - **Volume:** Recommended at 50-70% of maximum volume, adjustable based on the environment.
  - **Message Limit:** All ggwave protocols have a maximum message size of 140 bytes. Messages exceeding this limit must use the chunking mechanism described above.
- **Process:**
  1. Serialize the JSON message to a string.
  2. Encode the string into a waveform using ggwave.
  3. Play the waveform through the device's speaker.
  4. On the receiving end, capture the audio via the microphone, decode it with ggwave, and parse the resulting string back into JSON.

### Communication Flow

The protocol operates as follows:

1. **Connection Establishment:**
   - The online device plays a `connect` message with the current protocol version to signal readiness and request the wallet address.
   - The offline wallet, upon detecting the `connect`, checks the `version`. If supported, it responds with a `connect_response` message containing the wallet's Ethereum address and using the same version; otherwise, it sends an `error`.
   - If the `connect_response` exceeds 120 bytes, it will be automatically chunked and sent as multiple `chunk` messages.

2. **Transaction Request:**
   - After receiving the `connect_response`, the online device now knows the wallet address and can construct transactions. It sends a `tx_request` message containing the unsigned transaction data.
   - Large transaction requests may be chunked automatically if they exceed the 120-byte threshold.
   - The offline wallet captures the sound, decodes the `tx_request` (reassembling chunks if necessary), verifies the `version`, displays the transaction details to the user for confirmation, and optionally sends an `ack` to confirm receipt.

3. **Transaction Response:**
   - Upon user approval, the offline wallet signs the transaction, constructs a `tx_response` message with the signed transaction (including both the raw signed transaction and its hash), encodes it into sound, and plays it.
   - Large transaction responses may be chunked automatically if they exceed the 120-byte threshold.
   - The online device captures the sound, decodes the `tx_response` (reassembling chunks if necessary), verifies the `version`, and broadcasts the signed transaction to the Ethereum network.

4. **Chunked Message Handling:**
   - When a chunked message is detected, the receiver collects all chunks with the same `originalMessageId`.
   - Chunks are reassembled in order based on `chunkIndex` once all chunks are received.
   - The reassembled message is then processed as if it were received as a single message.

5. **Error Handling:**
   - If either device fails to receive an expected message within a 10-second timeout, it may retry (e.g., resend `connect` or return to listening mode).
   - If chunk reassembly fails or times out, the receiver should discard partial chunks.
   - Errors (e.g., corrupted data, unsupported version, chunking failures) are communicated via an `error` message with the appropriate version.

### Security Considerations

- **Short-range Communication:** Sound signals are intended for close proximity (e.g., within a few meters), reducing interception risks.
- **User Confirmation:** The offline wallet must display transaction details and require user approval before signing, mitigating malicious sound attacks.
- **Data Integrity:** Ggwave's built-in error correction ensures reliable transmission, but implementations should verify message integrity (e.g., via JSON parsing success).
- **Version Security:** Implementations must validate the `version` field to prevent processing of incompatible or malicious messages.

## Rationale

- **Contactless:** Sound eliminates the need for cables or visual alignment, unlike USB or QR codes.
- **Ubiquitous Hardware:** Most devices have speakers and microphones, making this widely adoptable.
- **Security:** Short-range audio, user confirmation, and versioned messages provide robust protection, while ggwave's error correction ensures reliability.
- **Versioning:** The `version` field ensures extensibility and compatibility, allowing future updates without breaking existing implementations.
- **Automatic Address Discovery:** The `connect`/`connect_response` mechanism eliminates the need for manual wallet address entry, reducing user errors and improving security by ensuring the address comes directly from the offline wallet.
- **Simplified User Experience:** Users only need to initiate a connection rather than manually copying wallet addresses, making the process more intuitive and less error-prone.

## Backwards Compatibility

This EIP introduces a new, optional communication method and does not affect existing Ethereum protocols or wallet standards. The `version` field ensures that future changes to the protocol can be adopted without disrupting existing implementations supporting version `"1.0"`.

## Test Cases

1. **Successful Transaction:**
   - Online device sends `connect` (version `"1.0"`), receives `connect_response` with wallet address, sends `tx_request`, and receives `tx_response` with a valid signed transaction.
2. **Address Discovery:**
   - Online device sends `connect`, receives `connect_response` containing the wallet address `0x742d35cc6bf8c3f2e4e4fd7a3f1b4c6e7d8e9f0a`, and can now construct transactions for this address.
3. **Chunked Connect Response:**
   - Online device sends `connect`, receives a large `connect_response` split into 3 chunks, successfully reassembles the chunks, and extracts the wallet address.
4. **Chunked Transaction Request:**
   - Online device sends a large `tx_request` (e.g., with extensive contract interaction data) that gets chunked into multiple parts, offline wallet receives and reassembles all chunks, and processes the complete transaction.
5. **Failed Chunk Reassembly:**
   - Offline wallet receives chunks 1 and 3 but misses chunk 2, times out waiting for the missing chunk, discards partial data, and may request retransmission.
6. **Noisy Environment:**
   - Offline wallet detects a corrupted `tx_request` and either ignores it or sends an `error` message (version `"1.0"`).
7. **Timeout:**
   - Online device sends `connect` but receives no `connect_response` within 10 seconds, then retries successfully.
8. **Version Mismatch:**
   - Online device sends `connect` with version `"2.0"`; offline wallet responds with an `error` in version `"1.0"`, indicating unsupported version.
9. **Security:**
   - A malicious `tx_request` is sent; offline wallet displays it and awaits user rejection.

## Implementation

Wallet developers can implement this protocol by:

1. Integrating the ggwave library (or equivalent) into both online and offline wallet software.
2. Supporting the specified JSON message format, including the `version` field, and the communication flow.
3. Implementing message chunking for messages exceeding 120 bytes:
   - Automatic chunking of outgoing messages
   - Sequential chunk transmission with completion waiting
   - Chunk collection and reassembly for incoming messages
   - Audio isolation during chunk transmission to prevent interference
   - Proper handling of chunk timeouts and failures
4. Ensuring the offline wallet includes a user interface for transaction confirmation.
5. Providing user feedback (e.g., "Place devices close together" or "Listening for sound").
6. Validating the `version` field and handling unsupported versions gracefully.
7. Using consistent ggwave protocol settings (recommended: "Fast" protocol ID 1) across all implementations for compatibility.
8. Using shortened UUID formats for message IDs to reduce message size and minimize chunking requirements.

### Notes

- **Environment:** Use in quiet settings with devices placed near each other (e.g., 1-2 meters apart) for best results.
- **Hardware:** Requires speakers and microphones on both devices, which may limit applicability to certain hardware wallets unless audio capabilities are added.