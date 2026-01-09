'use client';

import { useEffect, useState } from 'react';

export default function TypewriterList({
  items,
  delay = 20,
  itemDelay = 300,
  className = '',
}: {
  items: string[];
  delay?: number;
  itemDelay?: number;
  className?: string;
}) {
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [completedItems, setCompletedItems] = useState<string[]>([]);

  useEffect(() => {
    if (currentItemIndex >= items.length) return;

    const currentItem = items[currentItemIndex];

    if (currentCharIndex < currentItem.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + currentItem[currentCharIndex]);
        setCurrentCharIndex((prev) => prev + 1);
      }, delay);

      return () => clearTimeout(timeout);
    } else {
      // Current item complete, move to next after delay
      const timeout = setTimeout(() => {
        setCompletedItems((prev) => [...prev, displayedText]);
        setDisplayedText('');
        setCurrentCharIndex(0);
        setCurrentItemIndex((prev) => prev + 1);
      }, itemDelay);

      return () => clearTimeout(timeout);
    }
  }, [
    currentCharIndex,
    currentItemIndex,
    delay,
    displayedText,
    itemDelay,
    items,
  ]);

  return (
    <ul className={className}>
      {completedItems.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
      {currentItemIndex < items.length && (
        <li className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5">
            ✓
          </span>
          <span>
            {displayedText}
            {currentCharIndex < items[currentItemIndex].length && (
              <span className="animate-pulse">|</span>
            )}
          </span>
        </li>
      )}
    </ul>
  );
}
