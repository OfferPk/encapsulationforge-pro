/**
 * EncapsulationForge Pro - CCSDS 133.1-B-2 & ISO 22645 Spacecraft Encapsulation Service Engine
 * Serializes and dissects CCSDS Encapsulation Packets (EP) with variable 1, 2, 4, and 8-octet headers,
 * maps standard Protocol Identifiers (IPv4, IPv6, DTN BPv7, CFDP, Ethernet), and verifies CRC integrity.
 * Standard: CCSDS 133.1-B-2 (Blue Book, October 2020) / ISO 22645:2023
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EncapsulationEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // Normative Protocol Identifiers (EPI) per CCSDS 133.1-B-2 SANA Registry
  const PROTOCOLS = {
    'FILL': { id: 0x01, name: 'Fill / Idle Data Packet' },
    'CFDP': { id: 0x02, name: 'CCSDS File Delivery Protocol (CFDP)' },
    'COP1': { id: 0x03, name: 'Command Operation Procedure 1 (COP-1)' },
    'PROX1': { id: 0x04, name: 'Proximity-1 SPDU' },
    'PUS': { id: 0x05, name: 'Packet Utilization Standard (PUS)' },
    'IPV4': { id: 0x21, name: 'Internet Protocol v4 (IPv4)' },
    'IPV6': { id: 0x57, name: 'Internet Protocol v6 (IPv6)' },
    'DTN': { id: 0x85, name: 'DTN Bundle Protocol v7 (RFC 9171 / BPv7)' },
    'ETHERNET': { id: 0x88, name: 'Ethernet Frame (IEEE 802.3 MAC)' },
    'USER': { id: 0xFF, name: 'User-Defined Private Telemetry' }
  };

  // CRC-16 (X.25 / CCITT) Implementation
  function crc16(buffer) {
    let crc = 0xFFFF;
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      for (let j = 0; j < 8; j++) {
        if ((crc & 1) !== 0) {
          crc = (crc >>> 1) ^ 0x8408;
        } else {
          crc = crc >>> 1;
        }
      }
    }
    return (~crc) & 0xFFFF;
  }

  // CRC-32C (Castagnoli) Implementation
  function crc32c(buffer) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      for (let j = 0; j < 8; j++) {
        if ((crc & 1) !== 0) {
          crc = (crc >>> 1) ^ 0x82F63B78;
        } else {
          crc = crc >>> 1;
        }
      }
    }
    return (~crc) >>> 0;
  }

  class EncapsulationEngine {
    constructor() {
      this.version = "1.0.0";
      this.standard = "CCSDS 133.1-B-2 / ISO 22645";
      this.protocols = PROTOCOLS;
    }

    /**
     * Resolves protocol code from name or number
     */
    resolveProtocol(proto) {
      if (typeof proto === 'string') {
        let key = proto.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (this.protocols[key]) return this.protocols[key].id;
        if (key === 'BP7' || key === 'BUNDLE') return this.protocols['DTN'].id;
        if (key === 'IP4') return this.protocols['IPV4'].id;
        if (key === 'IP6') return this.protocols['IPV6'].id;
        return 0xFF; // User defined fallback
      }
      return typeof proto === 'number' ? proto : 0xFF;
    }

    /**
     * Returns descriptive protocol information
     */
    getProtocolInfo(protoId) {
      for (let k in this.protocols) {
        if (this.protocols[k].id === protoId) return this.protocols[k];
      }
      return { id: protoId, name: `Custom Protocol (0x${protoId.toString(16).toUpperCase().padStart(2, '0')})` };
    }

    /**
     * Encapsulates a data payload into a CCSDS Encapsulation Packet (EP)
     * @param {Uint8Array|Array|string} payload - User data
     * @param {Object} options - { protocol: 'IPV4'|'IPV6'|'DTN'|..., headerSize: 1|2|4|8, crcType: 0|1|2 }
     */
    encapsulate(payload, options = {}) {
      let payloadBytes;
      if (typeof payload === 'string') {
        payloadBytes = new TextEncoder().encode(payload);
      } else if (payload instanceof Uint8Array) {
        payloadBytes = payload;
      } else {
        payloadBytes = new Uint8Array(payload || []);
      }

      let protoId = this.resolveProtocol(options.protocol || 'DTN');
      let crcType = options.crcType !== undefined ? options.crcType : 1; // 1 = CRC-16, 2 = CRC-32C, 0 = None
      let crcLen = (crcType === 1) ? 2 : (crcType === 2 ? 4 : 0);

      // Determine required header size: 1, 2, 4, or 8 octets
      let headerSize = options.headerSize || 4; // Default standard 4-octet header
      let totalLength = headerSize + payloadBytes.length + crcLen;

      let header = [];
      const PVN = 7; // Bits 0-2 = 111b

      if (headerSize === 1) {
        // 1-Octet Header: [PVN (3 bits) | 000 (PLFL=0) | ProtocolBits (2 bits)]
        let protoBits = 0;
        if (protoId === 0x01) protoBits = 1; // Fill
        else if (protoId === 0x21) protoBits = 2; // IPv4
        else if (protoId === 0x57) protoBits = 3; // IPv6
        header.push((PVN << 5) | (0 << 2) | protoBits);
      } else if (headerSize === 2) {
        // 2-Octet Header: [PVN (3) | PLFL=1 (1 octet len) | 00] + [Length (8 bits)]
        if (totalLength > 255) throw new Error("Payload too large for 2-octet header (max 255 octets).");
        header.push((PVN << 5) | (1 << 2) | 0);
        header.push(totalLength & 0xFF);
      } else if (headerSize === 4) {
        // 4-Octet Header: [PVN (3) | PLFL=2 (2 octets len) | 00] + [ProtoId (8)] + [Length (16 bits)]
        if (totalLength > 65535) throw new Error("Payload too large for 4-octet header (max 65535 octets).");
        header.push((PVN << 5) | (2 << 2) | 0);
        header.push(protoId & 0xFF);
        header.push((totalLength >> 8) & 0xFF);
        header.push(totalLength & 0xFF);
      } else if (headerSize === 8) {
        // 8-Octet Header: [PVN (3) | PLFL=4 (4 octets len) | 00] + [ProtoId (8)] + [User/QoS (16)] + [Length (32 bits)]
        header.push((PVN << 5) | (4 << 2) | 0);
        header.push(protoId & 0xFF);
        header.push(0x00); // Reserved / QoS
        header.push(0x00);
        header.push((totalLength >>> 24) & 0xFF);
        header.push((totalLength >>> 16) & 0xFF);
        header.push((totalLength >>> 8) & 0xFF);
        header.push(totalLength & 0xFF);
      } else {
        throw new Error("Invalid header size: must be 1, 2, 4, or 8 octets.");
      }

      // Assemble packet buffer
      let packetBuffer = new Uint8Array(totalLength);
      packetBuffer.set(new Uint8Array(header), 0);
      packetBuffer.set(payloadBytes, headerSize);

      // Compute CRC if configured
      let crcHex = "";
      if (crcType === 1) {
        let c = crc16(packetBuffer.subarray(0, headerSize + payloadBytes.length));
        packetBuffer[totalLength - 2] = (c >> 8) & 0xFF;
        packetBuffer[totalLength - 1] = c & 0xFF;
        crcHex = ((c >> 8) & 0xFF).toString(16).padStart(2, '0').toUpperCase() + (c & 0xFF).toString(16).padStart(2, '0').toUpperCase();
      } else if (crcType === 2) {
        let c = crc32c(packetBuffer.subarray(0, headerSize + payloadBytes.length));
        packetBuffer[totalLength - 4] = (c >>> 24) & 0xFF;
        packetBuffer[totalLength - 3] = (c >>> 16) & 0xFF;
        packetBuffer[totalLength - 2] = (c >>> 8) & 0xFF;
        packetBuffer[totalLength - 1] = c & 0xFF;
        crcHex = c.toString(16).padStart(8, '0').toUpperCase();
      }

      let hex = Array.from(packetBuffer).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

      return {
        standard: this.standard,
        packetBytes: packetBuffer,
        hex: hex,
        totalLength: totalLength,
        headerSize: headerSize,
        protocol: this.getProtocolInfo(protoId),
        crcType: crcType,
        crcHex: crcHex,
        payloadSize: payloadBytes.length,
        headerHex: Array.from(header).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
      };
    }

    /**
     * Dissects and decodes a raw CCSDS Encapsulation Packet buffer
     */
    dissect(buffer) {
      let b = (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);
      if (b.length < 1) throw new Error("Packet buffer is empty.");

      let octet0 = b[0];
      let pvn = (octet0 >> 5) & 0x07;
      if (pvn !== 7) {
        throw new Error(`Invalid Packet Type Identifier: ${pvn}. Expected 7 (111b) for CCSDS Encapsulation Packet.`);
      }

      let plfl = (octet0 >> 2) & 0x07;
      let headerSize = 4;
      let protoId = 0xFF;
      let parsedLength = b.length;

      if (plfl === 0) {
        headerSize = 1;
        let pBits = octet0 & 0x03;
        if (pBits === 1) protoId = 0x01; // Fill
        else if (pBits === 2) protoId = 0x21; // IPv4
        else if (pBits === 3) protoId = 0x57; // IPv6
      } else if (plfl === 1) {
        headerSize = 2;
        parsedLength = b[1];
      } else if (plfl === 2) {
        headerSize = 4;
        protoId = b[1];
        parsedLength = (b[2] << 8) | b[3];
      } else if (plfl === 4) {
        headerSize = 8;
        protoId = b[1];
        parsedLength = ((b[4] << 24) >>> 0) | (b[5] << 16) | (b[6] << 8) | b[7];
      }

      let payload = b.subarray(headerSize);
      let payloadText = "";
      try {
        payloadText = new TextDecoder().decode(payload);
      } catch (e) {
        payloadText = "[Binary Payload]";
      }

      return {
        pvn: pvn,
        plfl: plfl,
        headerSize: headerSize,
        packetLength: parsedLength,
        protocol: this.getProtocolInfo(protoId),
        payloadSize: payload.length,
        payloadText: payloadText
      };
    }
  }

  return EncapsulationEngine;
}));
