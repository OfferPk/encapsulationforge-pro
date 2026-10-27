\# CCSDS 133.1-B-2 & ISO 22645 Spacecraft Encapsulation Service Specification

\#\# 1\. Scope & Operational Role  
The \*\*Consultative Committee for Space Data Systems (CCSDS)\*\* Recommendation \*\*CCSDS 133.1-B-2\*\* (and international standard \*\*ISO 22645:2023\*\*) defines the \*\*Encapsulation Service\*\*, which provides a standard framing and multiplexing protocol to encapsulate arbitrary network-layer packets (IPv4, IPv6, DTN Bundle Protocol v7, CFDP, Ethernet) into standardized \*\*Encapsulation Packets (EP)\*\*.

Encapsulation Packets are designed for direct transport over space link data link layers:  
\- \*\*Telemetry (TM) Space Data Link Protocol\*\* (CCSDS 132.0-B-3)  
\- \*\*Telecommand (TC) Space Data Link Protocol\*\* (CCSDS 232.0-B-4)  
\- \*\*AOS Space Data Link Protocol\*\* (CCSDS 732.0-B-4)  
\- \*\*Proximity-1 Space Link Protocol\*\* (CCSDS 211.0-B-6)

\---

\#\# 2\. Encapsulation Packet Architecture

\#\#\# Packet Type Identifier (PVN)  
Bits 0-2 of Octet 0 are permanently set to \`111\` binary (Decimal 7), distinguishing Encapsulation Packets from standard CCSDS Space Packets (PVN \= \`000\`b).

\#\#\# Packet Length Field Length (PLFL)  
Bits 3-5 of Octet 0 specify the length of the packet length field:  
\- \`000\`b (0): No packet length field present (1 or 2-octet header).  
\- \`001\`b (1): 1-octet packet length field (2 or 4-octet header, up to 255 octets).  
\- \`010\`b (2): 2-octet packet length field (4-octet header, up to 65,535 octets).  
\- \`100\`b (4): 4-octet packet length field (8-octet header, up to 4,294,967,295 octets).

\#\#\# Encapsulated Protocol Identifiers (EPI)  
Standard Protocol Identifiers defined by the SANA registry:  
\- \`0x01\`: Fill / Idle channel data  
\- \`0x02\`: CCSDS File Delivery Protocol (CFDP)  
\- \`0x03\`: Command Operation Procedure 1 (COP-1)  
\- \`0x05\`: Packet Utilization Standard (PUS)  
\- \`0x21\`: Internet Protocol Version 4 (IPv4)  
\- \`0x57\`: Internet Protocol Version 6 (IPv6)  
\- \`0x85\`: Delay-Tolerant Networking (DTN) Bundle Protocol Version 7 (RFC 9171\)  
\- \`0x88\`: Ethernet Frame (IEEE 802.3 MAC)  
\- \`0xFF\`: User-Defined Private Telemetry  
