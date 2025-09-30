'use client';

import React from 'react';

type Allocation = null | {
  shares: Record<string, number>;
  spent: number;
  leftover: number;
};

export default function SharesToPurchase({
  allocation,
  cadPriceOf,
  amount,
}: {
  allocation: Allocation;
  cadPriceOf: (sym: string) => number;
  amount: number;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold mb-2">Shares to Purchase</h2>
      {!allocation ? (
        <p className="text-neutral-600">
          Enter at least one valid symbol and wait for its price to load.
        </p>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 rounded-lg">
          <table className="w-full border-collapse">
            <thead className="bg-neutral-50">
              <tr>
                <Th>Symbol</Th>
                <Th>Buy (shares)</Th>
                <Th>Cost (CAD)</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(allocation.shares as Record<string, number>).map(
                ([sym, qty]) => {
                  const cost = qty * cadPriceOf(sym);
                  return (
                    <tr key={sym} className="border-t">
                      <Td>{sym}</Td>
                      <Td>{qty}</Td>
                      <Td>${cost.toFixed(2)}</Td>
                    </tr>
                  );
                }
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-neutral-50">
                <Td className="font-medium text-left">Budget</Td>
                <Td>&nbsp;</Td>
                <Td className="text-right font-medium">
                  ${amount.toFixed(2)} CAD
                </Td>
              </tr>
              <tr className="border-t bg-neutral-50">
                <Td className="font-medium text-left">Total (spent)</Td>
                <Td>&nbsp;</Td>
                <Td className="text-right font-medium">
                  ${allocation.spent.toFixed(2)} CAD
                </Td>
              </tr>
              <tr className="border-t bg-neutral-50">
                <Td className="font-medium text-left">Leftover</Td>
                <Td>&nbsp;</Td>
                <Td className="text-right font-medium">
                  ${allocation.leftover.toFixed(2)} CAD
                </Td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

/* Local cells */
function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`text-center text-sm font-medium px-3 py-2 ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`text-center p-2 align-middle ${className}`}>{children}</td>
  );
}
