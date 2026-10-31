/** Types for the parts of the vendored GS1 Digital Link Toolkit this worker uses. */
export default class GS1DigitalLinkToolkit {
  constructor();
  analyseURI(
    uri: string,
    extended: boolean
  ): { detected: string; uriStem: string; queryString: string };
  decompressGS1DigitalLink(
    compressed: string,
    useShortText: boolean,
    uriStem: string
  ): string;
  compressGS1DigitalLink(
    uri: string,
    useOptimisations: boolean,
    uriStem: string,
    uncompressedPrimary: boolean,
    useShortText: boolean,
    compressOtherKeyValuePairs: boolean
  ): string;
  /** Throws on a syntax error, including a wrong check digit. */
  extractFromGS1digitalLink(uri: string): {
    GS1: Record<string, string>;
    other: Record<string, string>;
  };
}
