#!/bin/bash
for worker in workers/*; do
    if [ -d "$worker" ]; then
        echo "Deploying $worker..."
        cd "$worker"
        if [ -f "wrangler.toml" ]; then
            npx wrangler deploy || echo "Failed to deploy $worker"
        else
            echo "Skipping $worker (no wrangler.toml)"
        fi
        cd ../..
    fi
done
