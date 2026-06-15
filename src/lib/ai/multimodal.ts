export async function fuseMultimodalData(visionConfidence: number, sensorData: any) {
  console.log("Fusing visual edge data with IoT sensor readings...");
  
  const visionWeight = 0.7;
  const sensorWeight = 0.3;
  
  const sensorScore = sensorData.tamperEvidentSealIntact ? 1.0 : 0.0;
  const finalConfidence = (visionConfidence * visionWeight) + (sensorScore * sensorWeight);
  
  return {
    decision: finalConfidence > 0.92 ? 'Authentic' : 'Suspicious',
    confidence: finalConfidence,
    flags: sensorScore === 0 ? ['Tamper seal breached'] : []
  };
}
