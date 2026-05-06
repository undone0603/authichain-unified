import { NextRequest, NextResponse } from 'next/server';
import { hasUnlimitedPlan } from '@/lib/business-tier';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { recipient, imageUrl, destinationUrl, qronId, registration_id } =
      await req.json();

    if (!recipient || !imageUrl || !destinationUrl) {
      return NextResponse.json(
        { error: 'recipient, imageUrl and destinationUrl are required' },
        { status: 400 }
      );
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    const contractAddress = process.env.QRON_NFT_CONTRACT_ADDRESS;

    if (!secretKey)
      return NextResponse.json(
        { error: 'THIRDWEB_SECRET_KEY not configured' },
        { status: 503 }
      );
    if (!contractAddress)
      return NextResponse.json(
        { error: 'QRON_NFT_CONTRACT_ADDRESS not configured' },
        { status: 503 }
      );

    // â”€â”€ Scan validation gate (if provenance registration exists) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const authichainUrl = process.env.AUTHICHAIN_API_URL;
    if (registration_id && authichainUrl) {
      try {
        const scanRes = await fetch(
          `${authichainUrl}/api/qron/scan-validate?registration_id=${encodeURIComponent(registration_id)}`,
          {
            headers: { 'X-API-Key': process.env.AUTHICHAIN_API_SECRET || '' },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (scanRes.ok) {
          const scanData = (await scanRes.json()) as { scannable?: boolean };
          if (scanData.scannable === false) {
            return NextResponse.json(
              {
                error:
                  'QR code is not scannable â€” cannot mint. Please regenerate.',
              },
              { status: 400 }
            );
          }
        }
        // If scan service unavailable, proceed (graceful degradation)
      } catch {
        console.warn('[qron/mint-nft] Scan validation check failed (non-fatal)');
      }
    }

    // â”€â”€ Business tier credit check (non-business users may need credits) â”€â”€â”€â”€â”€â”€
    const isUnlimited = await hasUnlimitedPlan(session.user.id);
    // For now, minting is free for all users with a valid QRON
    // Future: charge mint credits for non-business users

    // â”€â”€ thirdweb v5 server-side mint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { createThirdwebClient, getContract, sendTransaction } = await import(
      'thirdweb'
    );
    const { mintTo } = await import('thirdweb/extensions/erc721');
    const { privateKeyAccount } = await import('thirdweb/wallets');
    const { baseSepolia, base } = await import('thirdweb/chains');

    const chain =
      (process.env.NEXT_PUBLIC_THIRDWEB_CHAIN ?? 'base-sepolia') === 'base'
        ? base
        : baseSepolia;

    const client = createThirdwebClient({ secretKey });
    const contract = getContract({ client, chain, address: contractAddress });

    const metadata = {
      name: `QRON QR Code #${qronId ?? Date.now()}`,
      description: `AI-generated QR code linking to ${destinationUrl}. Created with the QRON Creative Studio â€” part of the AuthiChain Protocol.`,
      image: imageUrl,
      external_url: destinationUrl,
      attributes: [
        { trait_type: 'Destination', value: destinationUrl },
        { trait_type: 'Generator', value: 'QRON Creative Studio' },
        { trait_type: 'Protocol', value: 'AuthiChain' },
        { trait_type: 'Standard', value: 'ERC-721' },
        { trait_type: 'Plan', value: isUnlimited ? 'Business' : 'Standard' },
      ],
    };

    const minterKey =
      process.env.THIRDWEB_MINTER_KEY || process.env.MINTER_PRIVATE_KEY;
    if (!minterKey)
      return NextResponse.json(
        { error: 'Minter private key not configured' },
        { status: 503 }
      );

    const minterAccount = privateKeyAccount({ client, privateKey: minterKey });

    const mintTx = mintTo({ contract, to: recipient, nft: metadata });
    const receipt = await sendTransaction({
      transaction: mintTx,
      account: minterAccount,
    });

    console.log(
      '[qron/mint-nft] Minted to',
      recipient,
      'txHash:',
      receipt.transactionHash
    );

    // â”€â”€ Persist to Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      const { createClient: createSbClient } = await import(
        '@supabase/supabase-js'
      );
      const sbAdmin = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await sbAdmin.from('qron_nft_mints').insert({
        qron_id: qronId,
        recipient,
        image_url: imageUrl,
        destination_url: destinationUrl,
        tx_hash: receipt.transactionHash,
        chain: chain.name,
        contract_address: contractAddress,
        registration_id: registration_id || null,
        minted_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.warn('[qron/mint-nft] Non-fatal DB error:', dbErr);
    }

    // â”€â”€ Update AuthiChain provenance to 'minted' â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (registration_id && authichainUrl) {
      try {
        await fetch(`${authichainUrl}/api/qron-register/mint`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.AUTHICHAIN_API_SECRET || '',
          },
          body: JSON.stringify({
            registration_id,
            token_id: receipt.transactionHash, // Use tx hash as on-chain reference
            tx_hash: receipt.transactionHash,
            chain: chain.name,
            contract_address: contractAddress,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        console.warn('[qron/mint-nft] Provenance mint update failed (non-fatal)');
      }
    }

    return NextResponse.json({
      txHash: receipt.transactionHash,
      contractAddress,
      recipient,
      registration_id,
    });
  } catch (err: unknown) {
    console.error('[qron/mint-nft] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Mint failed' },
      { status: 500 }
    );
  }
}
