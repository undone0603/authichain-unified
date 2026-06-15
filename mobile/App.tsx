import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const API_URL = 'https://qron.space'; // Production API URL

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" color="#c9a227" />
      </View>
    );
  }

  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setIsLoading(true);
    console.log(`[Scanner] Barcode with type ${type} and data ${data} has been scanned!`);

    try {
      // Parse the shortcode from the scanned URL
      // e.g., https://qron.space/s/xyz123 -> xyz123
      const urlParts = data.split('/');
      const shortcodeOrId = urlParts[urlParts.length - 1];

      // Call the AuthiChain Verification API
      const response = await fetch(`${API_URL}/api/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // In production, an API key would be required for the mobile node
          // 'X-API-Key': 'sk_mobile_node_...' 
        },
        body: JSON.stringify({ qronId: shortcodeOrId }),
      });

      const result = await response.json();
      setVerificationResult(result);
    } catch (error) {
      console.error('[Scanner] Verification failed:', error);
      setVerificationResult({ error: 'Network Error or Invalid Tag' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>QRON ELITE NODE</Text>
      </View>

      {!scanned ? (
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        >
          <View style={styles.overlay}>
             <View style={styles.scanFrame} />
             <Text style={styles.overlayText}>Align QRON within frame to verify</Text>
          </View>
        </CameraView>
      ) : (
        <View style={styles.resultContainer}>
          {isLoading ? (
            <Text style={styles.loadingText}>VERIFYING PROTOCOL...</Text>
          ) : (
            <View style={styles.card}>
              <Text style={styles.resultTitle}>
                {verificationResult?.error ? 'VERIFICATION FAILED' : 'AUTHENTIC VERIFIED'}
              </Text>
              
              {!verificationResult?.error && (
                <>
                  <Text style={styles.detailText}>Target: {verificationResult?.targetUrl}</Text>
                  <Text style={styles.detailText}>Network: {verificationResult?.blockchain?.network}</Text>
                  <Text style={styles.detailText}>Anchor: {verificationResult?.blockchain?.tx_hash?.substring(0, 16)}...</Text>
                </>
              )}

              {verificationResult?.error && (
                <Text style={styles.errorText}>{verificationResult.error}</Text>
              )}

              <TouchableOpacity style={styles.button} onPress={() => { setScanned(false); setVerificationResult(null); }}>
                <Text style={styles.buttonText}>SCAN ANOTHER ASSET</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: '#fff'
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#111',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  headerText: {
    color: '#c9a227',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#c9a227',
    backgroundColor: 'transparent'
  },
  overlayText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    backgroundColor: '#111',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333'
  },
  loadingText: {
    color: '#c9a227',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2
  },
  resultTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 16
  },
  detailText: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
    fontFamily: 'monospace'
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16
  },
  button: {
    backgroundColor: '#c9a227',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20
  },
  buttonText: {
    color: '#000',
    fontWeight: '900',
    letterSpacing: 1
  }
});
