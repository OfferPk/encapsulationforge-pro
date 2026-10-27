#!/usr/bin/env python3
"""
Automated Test Runner for EncapsulationForge Pro
Verifies PVN=7 bitmask, PLFL length headers (1, 2, 4, 8 octets), protocol ID mappings, CRC-16, and 10-point normative auditor.
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from encapsulation_cli import encapsulate, audit, crc16_x25

class TestEncapsulationForge(unittest.TestCase):

    def test_01_pvn_identification(self):
        pkt = encapsulate(b"TEST", protocol="DTN", header_size=4)
        raw = bytes.fromhex(pkt["hex"])
        pvn = (raw[0] >> 5) & 0x07
        self.assertEqual(pvn, 7) # PVN = 111b

    def test_02_header_size_4_octets(self):
        pkt = encapsulate(b"DATA", protocol="IPV4", header_size=4)
        self.assertEqual(pkt["header_size"], 4)
        self.assertEqual(pkt["protocol_id"], "0x21")
        self.assertEqual(pkt["total_length"], 4 + 4 + 2) # header + payload + CRC-16

    def test_03_header_size_2_octets(self):
        pkt = encapsulate(b"PING", protocol="DTN", header_size=2, crc_type=0)
        self.assertEqual(pkt["header_size"], 2)
        self.assertEqual(pkt["total_length"], 2 + 4)

    def test_04_header_size_8_octets(self):
        pkt = encapsulate(b"LARGE_TELEMETRY", protocol="IPV6", header_size=8)
        self.assertEqual(pkt["header_size"], 8)
        self.assertEqual(pkt["protocol_id"], "0x57")

    def test_05_header_size_1_octet_fill(self):
        pkt = encapsulate(b"", protocol="FILL", header_size=1, crc_type=0)
        self.assertEqual(pkt["header_size"], 1)
        raw = bytes.fromhex(pkt["hex"])
        self.assertEqual(raw[0] & 0x03, 1) # Fill protocol bits

    def test_06_dtn_protocol_mapping(self):
        pkt = encapsulate(b"BP7", protocol="DTN")
        self.assertEqual(pkt["protocol_id"], "0x85")

    def test_07_cfdp_protocol_mapping(self):
        pkt = encapsulate(b"FILE", protocol="CFDP")
        self.assertEqual(pkt["protocol_id"], "0x02")

    def test_08_ethernet_protocol_mapping(self):
        pkt = encapsulate(b"MAC", protocol="ETHERNET")
        self.assertEqual(pkt["protocol_id"], "0x88")

    def test_09_crc16_integrity(self):
        pkt = encapsulate(b"PAYLOAD_WITH_CRC", crc_type=1)
        raw = bytes.fromhex(pkt["hex"])
        body = raw[:-2]
        c = crc16_x25(body)
        expected = f"{c:04X}"
        self.assertEqual(pkt["crc_hex"], expected)

    def test_10_normative_auditor_compliance(self):
        report = audit()
        self.assertEqual(report["status"], "PASSED")
        self.assertEqual(report["score"], "10/10 Normative Rules Compliant")
        self.assertEqual(len(report["rules"]), 10)

if __name__ == "__main__":
    unittest.main()
