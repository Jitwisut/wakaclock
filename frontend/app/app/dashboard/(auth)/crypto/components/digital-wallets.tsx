import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DigitalWallets() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Digital Wallets</CardTitle>
        <CardAction>
          <Button asChild variant="outline">
            <Link href="#">
              <ChevronRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <Link
          className="hover:border-primary/30 hover:bg-muted block rounded-md border px-4 py-3 transition-colors"
          href="#"
        >
          <div className="mb-2 flex items-center gap-2">
            <Image
              alt="shadcn/ui"
              className="size-6 object-contain"
              height={20}
              src="/images/crypto-icons/bitcoin.svg"
              unoptimized
              width={20}
            />
            <span>Bitcoin Wallet</span>
          </div>
          <div>4.434953 BTC</div>
        </Link>
        <Link
          className="hover:border-primary/30 hover:bg-muted block rounded-md border px-4 py-3 transition-colors"
          href="#"
        >
          <div className="mb-2 flex items-center gap-2">
            <Image
              alt="shadcn/ui"
              className="size-6 object-contain"
              height={20}
              src="/images/crypto-icons/ethereum.svg"
              unoptimized
              width={20}
            />
            <span>Ethereum Wallet</span>
          </div>
          <div>4.434953 ETH</div>
        </Link>
        <Link
          className="hover:border-primary/30 hover:bg-muted block rounded-md border px-4 py-3 transition-colors"
          href="#"
        >
          <div className="mb-2 flex items-center gap-2">
            <Image
              alt="..."
              className="size-6 object-contain"
              height={20}
              src="/images/crypto-icons/avalanche.svg"
              unoptimized
              width={20}
            />
            <span>Avalanche Wallet</span>
          </div>
          <div>3.434953 ETH</div>
        </Link>
      </CardContent>
    </Card>
  );
}
