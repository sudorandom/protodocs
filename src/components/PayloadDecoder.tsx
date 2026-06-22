import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fromBinary, toJsonString, fromJsonString, toBinary } from '@bufbuild/protobuf';
import { generateMockJson } from '../lib/mock-generator';

interface PayloadDecoderProps {
  typeIndex: Record<string, any>;
  registry: any;
  preselectedFqn?: string;
  onClose?: () => void;
  allowedProtocols?: string[];
}

interface DecodedFrame {
  id: number;
  type: 'data' | 'trailer' | 'eos' | 'error';
  flag: number;
  length: number;
  rawBytes: Uint8Array;
  decoded?: any; // parsed object or string content
  error?: string;
  hasEnvelope?: boolean;
}

// Convert Base64 string to Uint8Array
function base64ToBytes(base64: string): Uint8Array {
  const cleanBase64 = base64.trim().replace(/\s/g, '');
  const binString = atob(cleanBase64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

// Convert Hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().replace(/[^0-9a-fA-F]/g, '');
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Hexadecimal string must have an even number of characters.');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to Hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

// Convert Uint8Array to Base64 string
function bytesToBase64(bytes: Uint8Array): string {
  let binString = '';
  for (let i = 0; i < bytes.length; i++) {
    binString += String.fromCharCode(bytes[i]);
  }
  return btoa(binString);
}

// Custom syntax highlighting for JSON using theme CSS classes
function highlightJson(json: string): React.ReactNode {
  if (!json) return null;
  const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}[\],])/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let count = 0;

  while ((match = regex.exec(json)) !== null && count < 5000) {
    count++;
    const matchStr = match[0];
    const offset = match.index;

    if (offset > lastIndex) {
      parts.push(json.substring(lastIndex, offset));
    }

    if (matchStr.startsWith('"')) {
      if (matchStr.endsWith(':')) {
        parts.push(
          <span key={offset} className="text-syn-keyword font-semibold">
            {matchStr.slice(0, -1)}
          </span>
        );
        parts.push(':');
      } else {
        parts.push(
          <span key={offset} className="text-syn-string">
            {matchStr}
          </span>
        );
      }
    } else if (matchStr === 'true' || matchStr === 'false') {
      parts.push(
        <span key={offset} className="text-syn-primitive font-semibold">
          {matchStr}
        </span>
      );
    } else if (matchStr === 'null') {
      parts.push(
        <span key={offset} className="text-syn-comment italic">
          {matchStr}
        </span>
      );
    } else if (/^-?\d/.test(matchStr)) {
      parts.push(
        <span key={offset} className="text-syn-number">
          {matchStr}
        </span>
      );
    } else {
      parts.push(
        <span key={offset} className="text-app-textMuted">
          {matchStr}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < json.length) {
    parts.push(json.substring(lastIndex));
  }

  return (
    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-app-textMain select-text overflow-x-auto p-4 bg-app-code border border-app-border rounded-lg max-h-[500px]">
      {parts}
    </pre>
  );
}

export default function PayloadDecoder({
  typeIndex,
  registry,
  preselectedFqn,
  onClose,
  allowedProtocols,
}: PayloadDecoderProps) {
  const [activeMode, setActiveMode] = useState<'decode' | 'encode'>('encode');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
    return () => clearTimeout(timer);
  }, []);

  // Schema locked FQN state (read-only in UI)
  const [selectedFqn] = useState<string>(preselectedFqn || '');

  // Input states (Decode mode)
  const [inputText, setInputText] = useState<string>('');
  const [inputFormat, setInputFormat] = useState<'auto' | 'hex' | 'base64' | 'utf8' | 'binary'>('auto');
  const [detectedFormat, setDetectedFormat] = useState<string>('');

  const [protocol, setProtocol] = useState<'auto' | 'raw' | 'grpc' | 'grpc-web' | 'connect' | 'connect-json'>('auto');
  const [detectedProtocol, setDetectedProtocol] = useState<string>('');
  const [binaryData, setBinaryData] = useState<Uint8Array | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Output states (Decode mode)
  const [decodedFrames, setDecodedFrames] = useState<DecodedFrame[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<number | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Input states (Encode mode)
  const [jsonInput, setJsonInput] = useState<string>('');
  const [encodeProtocol, setEncodeProtocol] = useState<'raw' | 'grpc' | 'grpc-web' | 'connect' | 'connect-json'>('raw');
  const [encodeOutputFormat, setEncodeOutputFormat] = useState<'hex' | 'base64' | 'download'>('base64');
  const [encodeOutput, setEncodeOutput] = useState<string>('');
  const [encodeError, setEncodeError] = useState<string | null>(null);

  const isProtoEnabled = useCallback((protoValue: 'raw' | 'grpc' | 'grpc-web' | 'connect') => {
    if (!allowedProtocols || allowedProtocols.length === 0) return true;
    if (protoValue === 'raw') return true;
    if (protoValue === 'grpc') {
      return allowedProtocols.includes('grpc');
    }
    if (protoValue === 'grpc-web') {
      return allowedProtocols.includes('grpc-web');
    }
    if (protoValue === 'connect') {
      return allowedProtocols.includes('connect') || allowedProtocols.includes('connectrpc');
    }
    return false;
  }, [allowedProtocols]);

  // Fallback if current selections are not enabled by config
  useEffect(() => {
    if (!isProtoEnabled('grpc') && protocol === 'grpc') {
      setProtocol('raw');
    }
    if (!isProtoEnabled('grpc-web') && protocol === 'grpc-web') {
      setProtocol('raw');
    }
    if (!isProtoEnabled('connect') && (protocol === 'connect' || protocol === 'connect-json')) {
      setProtocol('raw');
    }
    if (!isProtoEnabled('grpc') && encodeProtocol === 'grpc') {
      setEncodeProtocol('raw');
    }
    if (!isProtoEnabled('grpc-web') && encodeProtocol === 'grpc-web') {
      setEncodeProtocol('raw');
    }
    if (!isProtoEnabled('connect') && (encodeProtocol === 'connect' || encodeProtocol === 'connect-json')) {
      setEncodeProtocol('raw');
    }
  }, [allowedProtocols, protocol, encodeProtocol, isProtoEnabled]);

  const activeMessageSchema = useMemo(() => {
    if (!selectedFqn || !registry) return null;
    const cleanFqn = selectedFqn.startsWith('.') ? selectedFqn.substring(1) : selectedFqn;
    try {
      return registry.getMessage(cleanFqn);
    } catch {
      return null;
    }
  }, [selectedFqn, registry]);

  // Load sample data
  const handleLoadSample = (type: 'raw_hex' | 'grpc_b64' | 'connect_json_hex') => {
    if (type === 'raw_hex') {
      setInputText('0a 0b 68 65 6c 6c 6f 20 77 6f 72 6c 64');
      setInputFormat('hex');
      setProtocol('raw');
    } else if (type === 'grpc_b64') {
      setInputText('AAAAAA0KC2hlbGxvIHdvcmxk');
      setInputFormat('base64');
      setProtocol('grpc');
    } else if (type === 'connect_json_hex') {
      setInputText('00 00 00 00 1a 7b 22 73 65 6e 74 65 6e 63 65 22 3a 22 68 65 6c 6c 6f 20 77 6f 72 6c 64 22 7d');
      setInputFormat('hex');
      setProtocol('connect-json');
    }
  };

  // Perform Decoding
  useEffect(() => {
    if (activeMode !== 'decode') return;
    setDecodeError(null);

    // Convert input to Uint8Array
    let bytes: Uint8Array = new Uint8Array(0);
    let resolvedFormat = inputFormat;

    if (inputFormat === 'binary') {
      if (binaryData) {
        bytes = binaryData;
      } else {
        setDecodedFrames([]);
        return;
      }
    } else {
      if (!inputText.trim()) {
        setDecodedFrames([]);
        setDetectedFormat('');
        setDetectedProtocol('');
        return;
      }

      // Auto-detect format if requested
      if (inputFormat === 'auto') {
        const trimmed = inputText.trim();
        const hexRegex = /^[0-9a-fA-F\s:,xX\\/]+$/;
        const b64Regex = /^[A-Za-z0-9+/=\s\r\n]+$/;

        if (hexRegex.test(trimmed) && trimmed.replace(/[^0-9a-fA-F]/g, '').length >= 2) {
          resolvedFormat = 'hex';
          setDetectedFormat('Hexadecimal (Detected)');
        } else if (b64Regex.test(trimmed) && trimmed.length % 4 === 0) {
          resolvedFormat = 'base64';
          setDetectedFormat('Base64 (Detected)');
        } else {
          resolvedFormat = 'utf8';
          setDetectedFormat('UTF-8 String (Detected)');
        }
      } else {
        setDetectedFormat('');
      }

      try {
        if (resolvedFormat === 'hex') {
          bytes = hexToBytes(inputText);
        } else if (resolvedFormat === 'base64') {
          bytes = base64ToBytes(inputText);
        } else {
          bytes = new TextEncoder().encode(inputText);
        }
      } catch (err: any) {
        setDecodeError(`Formatting Error: ${err.message}`);
        setDecodedFrames([]);
        return;
      }
    }

    if (bytes.length === 0) {
      setDecodedFrames([]);
      return;
    }

    // Smart Auto-Detect Protocol
    let resolvedProtocol = protocol;
    if (protocol === 'auto') {
      if (bytes.length >= 5) {
        const lenView = new DataView(bytes.buffer, bytes.byteOffset + 1, 4);
        const len = lenView.getUint32(0, false);

        // Check if length matches total envelope structure
        const isSingleEnveloped = 5 + len === bytes.length;
        const isMultipleEnveloped = 5 + len < bytes.length && (bytes.length - (5 + len)) % 5 === 0; // naive check

        if (isSingleEnveloped || isMultipleEnveloped) {
          // It's enveloped. Let's see if it's Connect or gRPC
          // Check flags. Connect uses 0x02 for EOS. gRPC uses 0x80 for trailers.
          let hasEos = false;
          let hasTrailer = false;
          let offset = 0;
          while (offset + 5 <= bytes.length) {
            const f = bytes[offset];
            const l = new DataView(bytes.buffer, bytes.byteOffset + offset + 1, 4).getUint32(0, false);
            if (f === 0x02) hasEos = true;
            if (f === 0x80) hasTrailer = true;
            offset += 5 + l;
          }

          if (hasEos && isProtoEnabled('connect')) {
            resolvedProtocol = 'connect';
            setDetectedProtocol('Connect Enveloped (Detected)');
          } else if (hasTrailer && (isProtoEnabled('grpc') || isProtoEnabled('grpc-web'))) {
            resolvedProtocol = isProtoEnabled('grpc') ? 'grpc' : 'grpc-web';
            setDetectedProtocol(resolvedProtocol === 'grpc' ? 'gRPC (Detected)' : 'gRPC-Web (Detected)');
          } else {
            // Check if payload starts with '{' or look like JSON for Connect JSON
            const payloadSample = bytes.subarray(5, Math.min(5 + len, 50));
            const sampleText = new TextDecoder().decode(payloadSample).trim();
            if ((sampleText.startsWith('{') || sampleText.startsWith('[')) && isProtoEnabled('connect')) {
              resolvedProtocol = 'connect-json';
              setDetectedProtocol('Connect JSON Enveloped (Detected)');
            } else if (isProtoEnabled('grpc') || isProtoEnabled('grpc-web')) {
              resolvedProtocol = isProtoEnabled('grpc') ? 'grpc' : 'grpc-web'; // default guess for binary enveloped
              setDetectedProtocol(resolvedProtocol === 'grpc' ? 'gRPC Binary (Detected)' : 'gRPC-Web Binary (Detected)');
            } else if (isProtoEnabled('connect')) {
              resolvedProtocol = 'connect'; // fallback to connect binary if grpc is disabled
              setDetectedProtocol('Connect Enveloped (Detected)');
            } else {
              resolvedProtocol = 'raw';
              setDetectedProtocol('Raw Protobuf (Detected)');
            }
          }
        } else {
          resolvedProtocol = 'raw';
          setDetectedProtocol('Raw Protobuf (Detected)');
        }
      } else {
        resolvedProtocol = 'raw';
        setDetectedProtocol('Raw Protobuf (Detected)');
      }
    } else {
      setDetectedProtocol('');
    }

    // Now parse frames based on resolved protocol
    if (resolvedProtocol === 'raw') {
      const frame: DecodedFrame = {
        id: 1,
        type: 'data',
        flag: 0,
        length: bytes.length,
        rawBytes: bytes,
        hasEnvelope: false,
      };

      if (!activeMessageSchema) {
        frame.error = 'No message schema selected. Cannot decode protobuf fields.';
      } else {
        try {
          const decodedMsg = fromBinary(activeMessageSchema, bytes);
          frame.decoded = JSON.parse(toJsonString(activeMessageSchema, decodedMsg));
        } catch (err: any) {
          frame.error = `Failed to parse binary protobuf using schema ${selectedFqn}: ${err.message}`;
        }
      }
      setDecodedFrames([frame]);
      setSelectedFrameId(1);
    } else {
      // Enveloped formats
      let offset = 0;
      const parsedFrames: DecodedFrame[] = [];
      let frameId = 1;

      while (offset < bytes.length) {
        if (offset + 5 > bytes.length) {
          parsedFrames.push({
            id: frameId++,
            type: 'error',
            flag: 0,
            length: 0,
            rawBytes: bytes.subarray(offset),
            error: `Truncated packet. Expected 5-byte header, only got ${bytes.length - offset} bytes.`,
            hasEnvelope: true,
          });
          break;
        }

        const flag = bytes[offset];
        const lenView = new DataView(bytes.buffer, bytes.byteOffset + offset + 1, 4);
        const len = lenView.getUint32(0, false);
        offset += 5;

        if (offset + len > bytes.length) {
          parsedFrames.push({
            id: frameId++,
            type: 'error',
            flag,
            length: len,
            rawBytes: bytes.subarray(offset - 5),
            error: `Truncated packet payload. Header claimed ${len} bytes, but only ${bytes.length - offset} bytes are available.`,
            hasEnvelope: true,
          });
          break;
        }

        const payload = bytes.subarray(offset, offset + len);
        offset += len;

        // Determine frame type
        let frameType: 'data' | 'trailer' | 'eos' | 'error' = 'data';
        if ((resolvedProtocol === 'grpc' || resolvedProtocol === 'grpc-web') && flag === 0x80) {
          frameType = 'trailer';
        } else if (resolvedProtocol === 'connect' && flag === 0x02) {
          frameType = 'eos';
        } else if (resolvedProtocol === 'connect-json' && flag === 0x02) {
          frameType = 'eos';
        }

        const frame: DecodedFrame = {
          id: frameId++,
          type: frameType,
          flag,
          length: len,
          rawBytes: payload,
          hasEnvelope: true,
        };

        // Attempt decode based on frame type
        if (frameType === 'data') {
          if (resolvedProtocol === 'connect-json') {
            try {
              const text = new TextDecoder().decode(payload);
              frame.decoded = JSON.parse(text);
            } catch (err: any) {
              frame.error = `Failed to parse Connect JSON payload: ${err.message}`;
            }
          } else {
            // Binary protobuf payload
            if (!activeMessageSchema) {
              frame.error = 'No message schema selected. Cannot decode protobuf fields.';
            } else {
              try {
                const decodedMsg = fromBinary(activeMessageSchema, payload);
                frame.decoded = JSON.parse(toJsonString(activeMessageSchema, decodedMsg));
              } catch (err: any) {
                frame.error = `Failed to decode payload with schema ${selectedFqn}: ${err.message}`;
              }
            }
          }
        } else if (frameType === 'trailer') {
          const trailersText = new TextDecoder().decode(payload);
          frame.decoded = trailersText;
        } else if (frameType === 'eos') {
          try {
            const text = new TextDecoder().decode(payload);
            frame.decoded = JSON.parse(text);
          } catch (err: any) {
            frame.error = `Failed to parse Connect EOS JSON: ${err.message}`;
          }
        }

        parsedFrames.push(frame);
      }

      setDecodedFrames(parsedFrames);
      if (parsedFrames.length > 0) {
        setSelectedFrameId(parsedFrames[0].id);
      } else {
        setSelectedFrameId(null);
      }
    }
  }, [inputText, inputFormat, protocol, selectedFqn, activeMessageSchema, binaryData, activeMode, isProtoEnabled]);

  // Pre-fill JSON mock when switching to Encoder or changing schema
  useEffect(() => {
    if (activeMode === 'encode' && selectedFqn && !jsonInput.trim()) {
      const template = generateMockJson(selectedFqn, typeIndex);
      setJsonInput(JSON.stringify(template, null, 2));
    }
  }, [selectedFqn, activeMode, typeIndex, jsonInput]);

  // Run Encoding in real-time for Base64 and Hex
  useEffect(() => {
    if (activeMode !== 'encode' || encodeOutputFormat === 'download') return;

    setEncodeError(null);
    setEncodeOutput('');

    if (!selectedFqn) return;
    if (!activeMessageSchema) {
      setEncodeError(`Message definition not found for schema ${selectedFqn}.`);
      return;
    }
    if (!jsonInput.trim()) return;

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(jsonInput);
    } catch (err: any) {
      setEncodeError(`Invalid JSON: ${err.message}`);
      return;
    }

    try {
      // 1. Serialize message to binary or JSON string
      let payloadBytes: Uint8Array;
      if (encodeProtocol === 'connect-json') {
        const jsonStr = JSON.stringify(parsedJson);
        payloadBytes = new TextEncoder().encode(jsonStr);
      } else {
        const messageInstance = fromJsonString(activeMessageSchema, JSON.stringify(parsedJson));
        payloadBytes = toBinary(activeMessageSchema, messageInstance);
      }

      // 2. Wrap in envelope if protocol is enveloped
      let finalBytes: Uint8Array = payloadBytes;
      if (encodeProtocol !== 'raw') {
        const flag = 0x00; // default data flag
        const envelope = new Uint8Array(5 + payloadBytes.length);
        envelope[0] = flag;
        const view = new DataView(envelope.buffer);
        view.setUint32(1, payloadBytes.length, false); // big endian length
        envelope.set(payloadBytes, 5);
        finalBytes = envelope;
      }

      // 3. Format output
      if (encodeOutputFormat === 'hex') {
        setEncodeOutput(bytesToHex(finalBytes));
      } else if (encodeOutputFormat === 'base64') {
        setEncodeOutput(bytesToBase64(finalBytes));
      }
    } catch (err: any) {
      setEncodeError(`Encoding failed: ${err.message}`);
    }
  }, [jsonInput, encodeProtocol, encodeOutputFormat, selectedFqn, activeMessageSchema, activeMode]);

  // Run Encoding
  const handleEncode = () => {
    setEncodeError(null);
    setEncodeOutput('');

    if (!selectedFqn) {
      setEncodeError('Please select a Message Schema.');
      return;
    }
    if (!activeMessageSchema) {
      setEncodeError(`Message definition not found for schema ${selectedFqn}.`);
      return;
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(jsonInput);
    } catch (err: any) {
      setEncodeError(`Invalid JSON input: ${err.message}`);
      return;
    }

    try {
      // 1. Serialize message to binary or JSON string
      let payloadBytes: Uint8Array;
      if (encodeProtocol === 'connect-json') {
        const jsonStr = JSON.stringify(parsedJson);
        payloadBytes = new TextEncoder().encode(jsonStr);
      } else {
        const messageInstance = fromJsonString(activeMessageSchema, JSON.stringify(parsedJson));
        payloadBytes = toBinary(activeMessageSchema, messageInstance);
      }

      // 2. Wrap in envelope if protocol is enveloped
      let finalBytes: Uint8Array = payloadBytes;
      if (encodeProtocol !== 'raw') {
        const flag = encodeProtocol === 'connect-json' ? 0x00 : 0x00; // default data flag
        const envelope = new Uint8Array(5 + payloadBytes.length);
        envelope[0] = flag;
        const view = new DataView(envelope.buffer);
        view.setUint32(1, payloadBytes.length, false); // big endian length
        envelope.set(payloadBytes, 5);
        finalBytes = envelope;
      }

      // 3. Format output
      if (encodeOutputFormat === 'hex') {
        setEncodeOutput(bytesToHex(finalBytes));
      } else if (encodeOutputFormat === 'base64') {
        setEncodeOutput(bytesToBase64(finalBytes));
      } else if (encodeOutputFormat === 'download') {
        const blob = new Blob([finalBytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedFqn.split('.').pop() || 'encoded'}_payload.bin`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setEncodeOutput('Binary file generated and download triggered!');
      }
    } catch (err: any) {
      setEncodeError(`Encoding failed: ${err.message}`);
    }
  };

  const selectedFrame = useMemo(() => {
    return decodedFrames.find((f) => f.id === selectedFrameId) || null;
  }, [decodedFrames, selectedFrameId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDownloadDecodedJson = () => {
    if (!selectedFrame || !selectedFrame.decoded) return;
    const jsonStr = JSON.stringify(selectedFrame.decoded, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decoded_frame_${selectedFrame.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      setBinaryData(bytes);
      setInputFormat('binary');
      setFilename(file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      setBinaryData(bytes);
      setInputFormat('binary');
      setFilename(file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  const clearBinaryFile = () => {
    setBinaryData(null);
    setFilename('');
    setInputFormat('auto');
  };

  return (
    <div ref={panelRef} className="bg-app-panel border border-app-border rounded-xl shadow-2xl overflow-hidden text-sm flex flex-col h-full max-w-5xl mx-auto">
      {/* Header bar */}
      <div className="px-6 py-3 bg-app-base border-b border-app-border flex items-center justify-between select-none">
        <div className="flex gap-1.5 bg-app-panel border border-app-border rounded-lg p-0.5">
          <button
            onClick={() => setActiveMode('encode')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              activeMode === 'encode'
                ? 'bg-app-accent text-white shadow'
                : 'text-app-textMuted hover:text-app-textBright'
            }`}
          >
            Payload Encoder
          </button>
          <button
            onClick={() => setActiveMode('decode')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              activeMode === 'decode'
                ? 'bg-app-accent text-white shadow'
                : 'text-app-textMuted hover:text-app-textBright'
            }`}
          >
            Payload Decoder
          </button>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-app-textMuted hover:text-app-textBright p-1.5 hover:bg-app-hoverBg rounded-lg transition-colors cursor-pointer"
            title="Close Playground"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 flex-1 divide-y md:divide-y-0 md:divide-x divide-app-border overflow-y-auto">
        {/* Left Control / Input Column */}
        <div className="p-6 space-y-5 flex flex-col justify-start">

          {activeMode === 'decode' ? (
            /* DECODE MODE INPUT CONTROLS */
            <>
              {/* Protocol & Format Configuration */}
              <div className="grid grid-cols-2 gap-4 select-none">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-app-textMuted">WIRE PROTOCOL</label>
                  <select
                    className="w-full bg-app-code border border-app-border rounded-lg px-2.5 py-2 text-xs text-app-textBright focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent font-sans"
                    value={protocol}
                    onChange={(e: any) => setProtocol(e.target.value)}
                  >
                    <option value="auto">Auto-Detect Protocol</option>
                    <option value="raw">Raw Protobuf Binary</option>
                    {isProtoEnabled('grpc') && <option value="grpc">gRPC</option>}
                    {isProtoEnabled('grpc-web') && <option value="grpc-web">gRPC-Web</option>}
                    {isProtoEnabled('connect') && (
                      <>
                        <option value="connect">Connect Binary</option>
                        <option value="connect-json">Connect JSON</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-app-textMuted">INPUT ENCODING</label>
                  <select
                    className="w-full bg-app-code border border-app-border rounded-lg px-2.5 py-2 text-xs text-app-textBright focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent font-sans"
                    value={inputFormat}
                    onChange={(e: any) => setInputFormat(e.target.value)}
                  >
                    <option value="auto">Auto-Detect Format</option>
                    <option value="hex">Hexadecimal</option>
                    <option value="base64">Base64</option>
                    <option value="utf8">Plain Text (UTF-8)</option>
                    <option value="binary">Binary File</option>
                  </select>
                </div>
              </div>

              {/* Sample Payloads */}
              <div className="space-y-1.5 select-none">
                <label className="text-xs font-bold text-app-textMuted">SAMPLE PAYLOADS</label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleLoadSample('raw_hex')}
                    className="px-2 py-1 bg-app-base border border-app-border hover:border-app-accent hover:bg-app-hoverBg rounded text-[10px] font-mono text-app-textBright cursor-pointer transition-colors"
                  >
                    Raw Hex
                  </button>
                  <button
                    onClick={() => handleLoadSample('grpc_b64')}
                    className="px-2 py-1 bg-app-base border border-app-border hover:border-app-accent hover:bg-app-hoverBg rounded text-[10px] font-mono text-app-textBright cursor-pointer transition-colors"
                  >
                    gRPC-Web Base64
                  </button>
                  <button
                    onClick={() => handleLoadSample('connect_json_hex')}
                    className="px-2 py-1 bg-app-base border border-app-border hover:border-app-accent hover:bg-app-hoverBg rounded text-[10px] font-mono text-app-textBright cursor-pointer transition-colors"
                  >
                    Connect JSON Hex
                  </button>
                </div>
              </div>

              {/* Text Input Area / Drag and Drop */}
              <div className="flex-1 flex flex-col space-y-1.5 min-h-[220px]">
                <label className="text-xs font-bold text-app-textMuted flex justify-between select-none">
                  <span>INPUT PAYLOAD TEXT OR DROP BINARY FILE</span>
                  {inputFormat === 'binary' && filename && (
                    <button
                      onClick={clearBinaryFile}
                      className="text-[10px] text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      Clear File
                    </button>
                  )}
                </label>
                {inputFormat === 'binary' && filename ? (
                  <div className="flex-1 border border-dashed border-app-accent bg-app-accentBg rounded-lg p-6 flex flex-col items-center justify-center text-center font-sans space-y-2 select-none">
                    <svg className="w-8 h-8 text-app-accent animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-semibold text-app-textBright text-xs">{filename}</span>
                    <span className="text-[10px] text-app-textMuted">Binary file loaded ({binaryData?.length || 0} bytes)</span>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex-1 flex flex-col relative rounded-lg border overflow-hidden ${
                      isDragging ? 'border-app-accent bg-app-accentBg' : 'border-app-border'
                    }`}
                  >
                    <textarea
                      placeholder={
                        isDragging
                          ? 'Drop the binary file here...'
                          : 'Paste Hex or Base64 data here, or drag & drop a raw binary protobuf file.'
                      }
                      className="flex-1 w-full bg-app-code text-app-textBright p-3 text-xs font-mono placeholder-app-textMuted/50 focus:outline-none resize-none border-none leading-relaxed"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                    <div className="absolute bottom-2.5 right-2.5 flex items-center select-none">
                      <label className="bg-app-panel hover:bg-app-hoverBg text-app-textBright border border-app-border rounded px-2 py-1 text-[10px] font-semibold cursor-pointer flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload File
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ENCODE MODE CONTROLS */
            <>
              {/* Protocol Configurations */}
              <div className="grid grid-cols-2 gap-4 select-none">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-app-textMuted">WIRE PROTOCOL</label>
                  <select
                    className="w-full bg-app-code border border-app-border rounded-lg px-2.5 py-2 text-xs text-app-textBright focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent font-sans"
                    value={encodeProtocol}
                    onChange={(e: any) => setEncodeProtocol(e.target.value)}
                  >
                    <option value="raw">Raw Protobuf Binary</option>
                    {isProtoEnabled('grpc') && <option value="grpc">gRPC</option>}
                    {isProtoEnabled('grpc-web') && <option value="grpc-web">gRPC-Web</option>}
                    {isProtoEnabled('connect') && (
                      <>
                        <option value="connect">Connect Binary</option>
                        <option value="connect-json">Connect JSON</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-app-textMuted">OUTPUT ENCODING</label>
                  <select
                    className="w-full bg-app-code border border-app-border rounded-lg px-2.5 py-2 text-xs text-app-textBright focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent font-sans"
                    value={encodeOutputFormat}
                    onChange={(e: any) => setEncodeOutputFormat(e.target.value)}
                  >
                    <option value="base64">Base64 Text</option>
                    <option value="hex">Hexadecimal Text</option>
                    <option value="download">Download as Binary File</option>
                  </select>
                </div>
              </div>

              {/* JSON Input Editor */}
              <div className="flex-1 flex flex-col space-y-1.5 min-h-[220px]">
                <label className="text-xs font-bold text-app-textMuted flex justify-between select-none">
                  <span>JSON PAYLOAD SOURCE</span>
                  <button
                    onClick={() => {
                      if (selectedFqn) {
                        const template = generateMockJson(selectedFqn, typeIndex);
                        setJsonInput(JSON.stringify(template, null, 2));
                      }
                    }}
                    className="text-[10px] text-syn-primitive hover:text-syn-primitive/80 font-semibold cursor-pointer"
                  >
                    Reset Template
                  </button>
                </label>
                <div className="flex-1 rounded-lg border border-app-border overflow-hidden flex flex-col">
                  <textarea
                    placeholder="Enter valid JSON structure matching selected message schema."
                    className="flex-1 w-full bg-app-code text-app-textBright p-3 text-xs font-mono placeholder-app-textMuted/50 focus:outline-none resize-none border-none leading-relaxed"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Encode Execute Button (Only for download) */}
              {encodeOutputFormat === 'download' && (
                <button
                  onClick={handleEncode}
                  className="w-full bg-app-accent hover:bg-app-accent/80 text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors shadow flex items-center justify-center gap-2 select-none"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Generate & Download Binary File
                </button>
              )}
            </>
          )}
        </div>

        {/* Right Output Column */}
        <div className="p-6 bg-app-code flex flex-col min-w-0">
          {activeMode === 'decode' ? (
            /* DECODE MODE OUTPUT DISPLAY */
            <div className="flex flex-col h-full space-y-4">
              <div className="flex items-center justify-between border-b border-app-border/40 pb-3 flex-wrap gap-2 select-none">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-app-textMuted uppercase tracking-wider">DECODED PAYLOAD</h3>
                  {detectedFormat && (
                    <span className="text-[10px] px-2 py-0.5 bg-app-panel text-app-textBright rounded border border-app-border font-mono">
                      {detectedFormat}
                    </span>
                  )}
                  {detectedProtocol && (
                    <span className="text-[10px] px-2 py-0.5 bg-app-panel text-syn-option rounded border border-app-border font-mono">
                      {detectedProtocol}
                    </span>
                  )}
                </div>
                {selectedFrame && selectedFrame.decoded && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedFrame.decoded, null, 2))}
                      className="px-2 py-1 bg-app-panel border border-app-border hover:bg-app-hoverBg rounded text-[10px] font-semibold text-app-textBright cursor-pointer transition-colors"
                      title="Copy JSON to Clipboard"
                    >
                      Copy JSON
                    </button>
                    <button
                      onClick={handleDownloadDecodedJson}
                      className="px-2 py-1 bg-app-panel border border-app-border hover:bg-app-hoverBg rounded text-[10px] font-semibold text-app-textBright cursor-pointer transition-colors"
                      title="Download JSON file"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => {
                        setJsonInput(JSON.stringify(selectedFrame.decoded, null, 2));
                        setActiveMode('encode');
                      }}
                      className="px-2 py-1 bg-app-panel border border-app-border hover:bg-app-hoverBg rounded text-[10px] font-semibold text-syn-primitive cursor-pointer transition-colors"
                      title="Load this JSON inside the Encoder"
                    >
                      Use in Encoder
                    </button>
                  </div>
                )}
              </div>

              {decodeError && (
                <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-xs text-red-400 font-mono select-text whitespace-pre-wrap leading-normal">
                  {decodeError}
                </div>
              )}

              {/* Frames Selector (Streaming Enveloped) */}
              {!decodeError && decodedFrames.length > 1 && (
                <div className="space-y-1.5 select-none">
                  <span className="text-[10px] font-bold text-app-textMuted uppercase">STREAM PAYLOAD FRAMES ({decodedFrames.length})</span>
                  <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    {decodedFrames.map((frame) => {
                      const isSelected = selectedFrameId === frame.id;
                      let badgeColor = 'bg-app-panel text-app-textBright border-app-border';
                      if (frame.type === 'trailer') badgeColor = 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30';
                      if (frame.type === 'eos') badgeColor = 'bg-purple-950/20 text-purple-400 border-purple-900/30';
                      if (frame.type === 'error') badgeColor = 'bg-red-950/20 text-red-400 border-red-900/30';

                      return (
                        <button
                          key={frame.id}
                          onClick={() => setSelectedFrameId(frame.id)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer shrink-0 transition-all font-mono ${
                            isSelected
                              ? 'bg-app-accent text-white border-app-accent shadow'
                              : badgeColor
                          }`}
                        >
                          Frame #{frame.id} ({frame.type.toUpperCase()})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Render Output Content */}
              {!decodeError && decodedFrames.length > 0 && selectedFrame ? (
                <div className="flex-1 flex flex-col justify-start min-h-0">
                  {selectedFrame.error ? (
                    <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-lg text-xs text-red-400 font-mono whitespace-pre-wrap select-text space-y-3 leading-normal">
                      <p className="font-semibold">{selectedFrame.error}</p>
                      <div className="space-y-1">
                        <span className="font-sans text-[10px] text-app-textMuted font-bold">RAW HEX PAYLOAD DUMP</span>
                        <pre className="p-2.5 bg-black/40 rounded text-[10px] whitespace-pre-wrap select-all font-mono break-all leading-normal">
                          {bytesToHex(selectedFrame.rawBytes)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0">
                      {selectedFrame.type === 'data' || selectedFrame.type === 'eos' ? (
                        <div className="flex-1 overflow-y-auto">
                          {highlightJson(JSON.stringify(selectedFrame.decoded, null, 2))}
                        </div>
                      ) : selectedFrame.type === 'trailer' ? (
                        <div className="space-y-2 select-text">
                          <div className="text-[10px] font-bold text-app-textMuted uppercase select-none">gRPC / gRPC-Web Trailers</div>
                          <pre className="p-4 bg-app-code border border-app-border rounded-lg font-mono text-xs text-syn-option whitespace-pre overflow-x-auto leading-relaxed">
                            {selectedFrame.decoded}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Frame Stats */}
                  <div className="mt-3 text-[10px] font-mono text-app-textMuted flex items-center justify-between border-t border-app-border/40 pt-2 flex-wrap gap-2 select-none">
                    <span>Frame Length: {selectedFrame.length} bytes</span>
                    {selectedFrame.hasEnvelope && (
                      <span>
                        Envelope Flag: 0x{selectedFrame.flag.toString(16).padStart(2, '0')}
                        {selectedFrame.flag === 0x00 && ' (Data)'}
                        {selectedFrame.flag === 0x80 && ' (Trailer)'}
                        {selectedFrame.flag === 0x02 && ' (End of Stream)'}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                !decodeError && (
                  <div className="flex-1 border border-dashed border-app-border rounded-lg flex items-center justify-center p-8 text-center text-xs text-app-textMuted select-none">
                    Enter payload text or drag-and-drop a binary file to start decoding.
                  </div>
                )
              )}
            </div>
          ) : (
            /* ENCODE MODE OUTPUT DISPLAY */
            <div className="flex flex-col h-full space-y-4">
              <div className="flex items-center justify-between border-b border-app-border/40 pb-3 flex-wrap gap-2 select-none">
                <h3 className="text-xs font-bold text-app-textMuted uppercase tracking-wider">ENCODED RESULT</h3>
                {encodeOutput && encodeOutputFormat !== 'download' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(encodeOutput)}
                      className="px-2 py-1 bg-app-panel border border-app-border hover:bg-app-hoverBg rounded text-[10px] font-semibold text-app-textBright cursor-pointer transition-colors"
                      title="Copy Encoded String"
                    >
                      Copy Output
                    </button>
                    <button
                      onClick={() => {
                        setInputText(encodeOutput);
                        setInputFormat(encodeOutputFormat);
                        setProtocol(encodeProtocol);
                        setActiveMode('decode');
                      }}
                      className="px-2 py-1 bg-app-panel border border-app-border hover:bg-app-hoverBg rounded text-[10px] font-semibold text-syn-option cursor-pointer transition-colors"
                      title="Inspect/decode this output"
                    >
                      Open in Decoder
                    </button>
                  </div>
                )}
              </div>

              {encodeError && (
                <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-xs text-red-400 font-mono select-text whitespace-pre-wrap leading-normal">
                  {encodeError}
                </div>
              )}

              {encodeOutput ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="p-4 bg-app-code border border-app-border rounded-lg overflow-x-auto max-h-[400px]">
                    <pre className="whitespace-pre-wrap font-mono text-xs text-syn-string break-all select-all leading-normal">
                      {encodeOutput}
                    </pre>
                  </div>
                  <div className="text-[10px] font-mono text-app-textMuted flex justify-between select-none mt-3">
                    <span>Format: {encodeOutputFormat.toUpperCase()}</span>
                    <span>Protocol: {encodeProtocol.toUpperCase()}</span>
                  </div>
                </div>
              ) : (
                !encodeError && (
                  <div className="flex-1 border border-dashed border-app-border rounded-lg flex items-center justify-center p-8 text-center text-xs text-app-textMuted select-none">
                    Configure parameters and click "Generate Encoded Payload" to build bytes.
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
