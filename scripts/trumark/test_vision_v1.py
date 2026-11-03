import sys
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from vision_v1 import STATUS, inspect_image, hamming64, evaluate_photo_pair, compare_same_view


class VisionUnitTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.front = Path(self.tmp.name) / "front.png"
        self.back = Path(self.tmp.name) / "back.png"
        a = np.zeros((900, 900, 3), np.uint8)
        cv2.rectangle(a, (120, 120), (780, 780), (200, 200, 200), -1)
        cv2.circle(a, (450, 450), 70, (10, 10, 10), -1)
        cv2.imwrite(str(self.front), a)
        cv2.imwrite(str(self.back), cv2.flip(a, 1))

    def test_never_authenticates(self):
        result = evaluate_photo_pair(self.front, self.back)
        self.assertEqual(result["status"], STATUS)
        self.assertFalse(result["physicalAuthentication"])
        self.assertFalse(result["ocrPerformed"])
        self.assertFalse(result["manufacturerMatchPerformed"])

    def test_exact_bytes(self):
        first = inspect_image(self.front)
        self.assertEqual(inspect_image(self.front, first["sha256"])["byteIntegrity"], "MATCH")
        self.front.write_bytes(self.front.read_bytes() + b"a")
        changed = inspect_image(self.front, first["sha256"])
        self.assertEqual(changed["byteIntegrity"], "MISMATCH")

    def test_same_photo_is_diagnostic(self):
        self.assertEqual(hamming64("0", "0"), 0)
        result = compare_same_view(self.front, self.front)
        self.assertEqual(result["distanceOf64Bits"], 0)
        self.assertEqual(result["authenticityVerdict"], "NOT_EVALUATED")

    def test_non_image_rejected(self):
        self.front.write_bytes(b"invalid")
        with self.assertRaises(ValueError):
            inspect_image(self.front)


if __name__ == "__main__":
    unittest.main()
