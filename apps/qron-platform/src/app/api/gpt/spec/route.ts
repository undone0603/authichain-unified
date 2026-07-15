/**
 * @file route.ts
 * @project qron-platform
 * @author AuthiChain AI Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gpt/spec
 * 
 * Serves the OpenAPI specification for the AuthiChain GPT.
 * This allows ChatGPT to autonomously generate and verify QRONs.
 */
export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "AuthiChain Protocol API",
      description: "API for generating and verifying cryptographically-signed QR art (QRONs) and industrial certifications.",
      version: "1.4.2"
    },
    servers: [
      {
        url: "https://qron.space",
        description: "Production Environment"
      }
    ],
    paths: {
      "/api/v1/generate": {
        post: {
          operationId: "generateQron",
          summary: "Generate a new QRON",
          description: "Creates an AI-generated, scannable QR code with cryptographic anchoring.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", description: "The destination URL" },
                    prompt: { type: "string", description: "AI artistic style guidance" },
                    mode: { type: "string", enum: ["standard", "industrial"], default: "standard" }
                  },
                  required: ["url", "prompt"]
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Successful generation",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      qron: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          imageUrl: { type: "string" },
                          prompt: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          security: [{ ApiKeyAuth: [] }]
        }
      },
      "/api/v1/verify": {
        get: {
          operationId: "verifyAsset",
          summary: "Verify an Asset",
          description: "Validates the cryptographic signature and industrial provenance of an AuthiChain serial number.",
          parameters: [
            {
              name: "serial",
              in: "query",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": {
              description: "Verification result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      is_authentic: { type: "boolean" },
                      details: { type: "object" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key"
        }
      }
    }
  };

  return NextResponse.json(spec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }
  });
}
