'use client';

import { useState } from 'react';

import Image from 'next/image';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const coins = [
  {
    name: 'Bitcoin',
    short_name: 'BTC',
    icon: 'bitcoin',
  },
  {
    name: 'Avalanche',
    short_name: 'AVAX',
    icon: 'avalanche',
  },
  {
    name: 'Ethereum',
    short_name: 'ETH',
    icon: 'ethereum',
  },
  {
    name: 'Solana',
    short_name: 'SOL',
    icon: 'solana',
  },
  {
    name: 'Tether',
    short_name: 'USDT',
    icon: 'tether',
  },
  {
    name: 'XRP',
    short_name: 'XRP',
    icon: 'xrp',
  },
  {
    name: 'Dogecoin',
    short_name: 'DOGE',
    icon: 'dogecoin',
  },
];

export function TradingCard() {
  const form = useForm();
  const [selectedCoin, setSelectedCoin] = useState<string>(coins[0].name);
  const [, setTransactionType] = useState<string>('buy');

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Trading</CardDescription>
        <CardTitle className="font-display text-3xl">$46,200</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="buy" onValueChange={setTransactionType}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger className="w-full" value="buy">
              Buy
            </TabsTrigger>
            <TabsTrigger className="w-full" value="sell">
              Sell
            </TabsTrigger>
          </TabsList>
          <TabsContent value="buy">
            <Form {...form}>
              <form className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={() => (
                    <FormItem>
                      <FormLabel>Coin</FormLabel>
                      <FormControl>
                        <Select defaultValue={selectedCoin} onValueChange={setSelectedCoin}>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              <div className="flex items-center gap-2">
                                <Image
                                  alt="..."
                                  className="size-6"
                                  height={20}
                                  src={`/images/crypto-icons/${coins.find((coin) => coin.name === selectedCoin)?.icon}.svg`}
                                  unoptimized
                                  width={20}
                                />
                                {coins.find((coin) => coin.name === selectedCoin)?.name}/
                                {coins.find((coin) => coin.name === selectedCoin)?.short_name}
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {coins.map((coin) => (
                              <SelectItem key={coin.name} value={coin.name}>
                                <div className="flex items-center gap-2">
                                  <Image
                                    alt="..."
                                    className="size-6"
                                    height={20}
                                    src={`/images/crypto-icons/${coin.icon}.svg`}
                                    unoptimized
                                    width={20}
                                  />
                                  {coin.name}/{coin.short_name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid space-y-4 lg:grid-cols-2 lg:space-y-0 lg:space-x-4">
                  <FormField
                    control={form.control}
                    name="amount_coin"
                    render={() => (
                      <FormItem>
                        <FormLabel>
                          Amount ({coins.find((c) => c.name === selectedCoin)?.short_name})
                        </FormLabel>
                        <FormControl>
                          <Input defaultValue="$0,0000005" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount_currency"
                    render={() => (
                      <FormItem>
                        <FormLabel>Amount (USD)</FormLabel>
                        <FormControl>
                          <Input defaultValue="0,0000005" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button className="w-full">Make Payment</Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="sell">
            <Form {...form}>
              <form className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={() => (
                    <FormItem>
                      <FormLabel>Coin</FormLabel>
                      <FormControl>
                        <Select defaultValue={selectedCoin} onValueChange={setSelectedCoin}>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              <div className="flex items-center gap-2">
                                <Image
                                  alt="..."
                                  className="size-6"
                                  height={20}
                                  src={`/images/crypto-icons/${coins.find((coin) => coin.name === selectedCoin)?.icon}.svg`}
                                  unoptimized
                                  width={20}
                                />
                                {coins.find((coin) => coin.name === selectedCoin)?.name}/
                                {coins.find((coin) => coin.name === selectedCoin)?.short_name}
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {coins.map((coin) => (
                              <SelectItem key={coin.name} value={coin.name}>
                                <div className="flex items-center gap-2">
                                  <Image
                                    alt="..."
                                    className="size-6"
                                    height={20}
                                    src={`/images/crypto-icons/${coin.icon}.svg`}
                                    unoptimized
                                    width={20}
                                  />
                                  {coin.name}/{coin.short_name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid space-y-4 lg:grid-cols-2 lg:space-y-0 lg:space-x-4">
                  <FormField
                    control={form.control}
                    name="amount_coin"
                    render={() => (
                      <FormItem>
                        <FormLabel>Amount (BTC)</FormLabel>
                        <FormControl>
                          <Input defaultValue="$0,0000008" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount_currency"
                    render={() => (
                      <FormItem>
                        <FormLabel>Amount (USD)</FormLabel>
                        <FormControl>
                          <Input defaultValue="0,0000004" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button className="w-full">Place Offer</Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
