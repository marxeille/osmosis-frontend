import { CoinPretty, Dec } from "@keplr-wallet/unit";
import classNames from "classnames";
import { FC, useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "~/components/assets";
import { DynamicSizeInput } from "~/components/input/dynamic-size-input";
import { useCoinPrice } from "~/hooks/queries/assets/use-coin-price";
import { formatPretty } from "~/utils/formatter";

export interface LimitInputProps {
  baseAsset: CoinPretty;
}

enum FocusedInput {
  FIAT = "fiat",
  TOKEN = "token",
}

const nonFocusedClasses =
  "top-[58%] scale-[20%] text-wosmongton-200 hover:cursor-pointer select-none";
const focusedClasses = "top-[20%]";

const transformAmount = (value: string) => {
  let updatedValue = value;
  if (value.endsWith(".") && value.length === 1) {
    updatedValue = value + "0";
  }

  if (value.startsWith(".")) {
    updatedValue = "0" + value;
  }

  return updatedValue;
};

export const LimitInput: FC<LimitInputProps> = ({ baseAsset }) => {
  const [fiatAmount, setFiatAmount] = useState<string>("");
  const [tokenAmount, setTokenAmount] = useState<string>("");
  const { price, isLoading } = useCoinPrice(baseAsset);
  const [focused, setFocused] = useState<FocusedInput>(FocusedInput.FIAT);

  const swapFocus = useCallback(() => {
    switch (focused) {
      case FocusedInput.FIAT:
        setFocused(FocusedInput.TOKEN);
        break;
      case FocusedInput.TOKEN:
      default:
        setFocused(FocusedInput.FIAT);
        break;
    }
  }, [focused]);

  const setFiatAmountSafe = useCallback(
    (value: string) => {
      const updatedValue = transformAmount(value);

      if (updatedValue.length > 0 && new Dec(updatedValue).isNegative()) {
        return;
      }
      setFiatAmount(updatedValue);
    },
    [setFiatAmount]
  );

  const setTokenAmountSafe = useCallback(
    (value: string) => {
      const updatedValue = transformAmount(value);

      if (updatedValue.length > 0 && new Dec(updatedValue).isNegative()) {
        return;
      }
      setTokenAmount(updatedValue);
    },
    [setTokenAmount]
  );

  useEffect(() => {
    if (isLoading || focused !== FocusedInput.TOKEN) return;
    const value = tokenAmount && tokenAmount.length > 0 ? tokenAmount : "0";
    const fiatValue = price?.mul(new Dec(value));
    const newFiatAmount = fiatValue?.toDec() ?? new Dec(0);
    setFiatAmountSafe(formatPretty(newFiatAmount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price, isLoading, tokenAmount, setFiatAmountSafe]);

  useEffect(() => {
    if (isLoading || focused !== FocusedInput.FIAT) return;
    const value = fiatAmount && fiatAmount.length > 0 ? fiatAmount : "0";
    const tokenValue = new Dec(value)?.quo(price?.toDec() ?? new Dec(1));
    const newTokenAmount = tokenValue ?? new Dec(0);
    setTokenAmountSafe(formatPretty(newTokenAmount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price, isLoading, fiatAmount, setTokenAmountSafe]);
  console.log(isLoading);
  const FiatInput = useMemo(() => {
    const isFocused = focused === FocusedInput.FIAT;
    return (
      <div
        className={classNames(
          "absolute flex w-full flex-row items-center justify-center text-h1 transition-all",
          {
            [nonFocusedClasses]: !isFocused,
            [focusedClasses]: isFocused,
          }
        )}
        onClick={focused === FocusedInput.TOKEN ? swapFocus : undefined}
      >
        <span className="mr-1">$</span>
        <DynamicSizeInput
          placeholder="0"
          type="number"
          value={fiatAmount}
          className={classNames(
            "bg-transparent text-center placeholder:text-white-disabled focus:outline-none",
            { "cursor-pointer": !isFocused }
          )}
          onChange={setFiatAmountSafe}
          onClick={!isFocused ? swapFocus : undefined}
        />
        {focused === FocusedInput.TOKEN && <Icon id="chevron-up" />}
      </div>
    );
  }, [fiatAmount, focused, swapFocus, setFiatAmountSafe]);

  const TokenInput = useMemo(() => {
    const isFocused = focused === FocusedInput.TOKEN;
    return (
      <div
        className={classNames(
          "absolute flex w-full flex-row items-center justify-center gap-1 text-h1 transition-all",
          {
            [nonFocusedClasses]: !isFocused,
            [focusedClasses]: isFocused,
          }
        )}
        onClick={focused === FocusedInput.FIAT ? swapFocus : undefined}
      >
        <DynamicSizeInput
          type="number"
          placeholder="0"
          value={tokenAmount}
          className={classNames(
            "bg-transparent text-center placeholder:text-white-disabled focus:outline-none",
            { "cursor-pointer": !isFocused }
          )}
          onChange={setTokenAmountSafe}
          onClick={!isFocused ? swapFocus : undefined}
        />
        <span
          className={classNames("ml-2 text-wosmongton-200", {
            "opacity-60": focused === FocusedInput.TOKEN,
          })}
        >
          {baseAsset ? baseAsset.denom : ""}
        </span>
        {focused === FocusedInput.FIAT && (
          <Icon id="chevron-up" width={16} height={16} />
        )}
      </div>
    );
  }, [tokenAmount, setTokenAmountSafe, focused, baseAsset, swapFocus]);

  return (
    <div className="relative h-[200px]">
      {FiatInput}
      {TokenInput}
    </div>
  );
};