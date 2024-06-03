import { WalletStatus } from "@cosmos-kit/core";
import { Dec } from "@keplr-wallet/unit";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import { FunctionComponent, useMemo, useRef } from "react";

import { Icon } from "~/components/assets";
import { Tooltip } from "~/components/tooltip";
import { Button } from "~/components/ui/button";
import { useTranslation, useWindowSize } from "~/hooks";
import { usePlaceLimit } from "~/hooks/limit-orders";
import { useStore } from "~/stores";
import { formatPretty } from "~/utils/formatter";

export interface PlaceLimitToolProps {
  tokenInDenom: string;
  tokenOutDenom: string;
  orderbookContractAddress?: string;
}

const percentAdjustmentOptions = [
  { value: new Dec(0), label: "0%" },
  { value: new Dec(0.02), label: "2%" },
  { value: new Dec(0.05), label: "5%" },
  { value: new Dec(0.1), label: "10%" },
];

export const PlaceLimitTool: FunctionComponent<PlaceLimitToolProps> = observer(
  ({
    tokenInDenom,
    tokenOutDenom,
    orderbookContractAddress = "osmo1svmdh0ega4jg44xc3gg36tkjpzrzlrgajv6v6c2wf0ul8m3gjajs0dps9w",
  }) => {
    const { accountStore } = useStore();
    const { t } = useTranslation();
    const swapState = usePlaceLimit({
      osmosisChainId: "localosmosis",
      assetIn: tokenInDenom,
      assetOut: tokenOutDenom,
      orderbookContractAddress,
      useQueryParams: false,
    });
    const fromAmountInputEl = useRef<HTMLInputElement | null>(null);
    const { isMobile } = useWindowSize();
    const account = accountStore.getWallet("localosmosis");

    const isSwapToolLoading = false;

    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 py-[22px] transition-all md:rounded-xl md:py-2.5 md:px-3">
          <div className="flex place-content-end items-center transition-opacity">
            <div className="flex items-center gap-1.5">
              <Tooltip
                content={
                  <div className="text-center">
                    {t("swap.maxButtonErrorNoBalance")}
                  </div>
                }
                disabled={!swapState.inAmountInput.notEnoughBalanceForMax}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className={classNames(
                    "text-wosmongton-300",
                    swapState.inAmountInput.isMaxValue &&
                      !swapState.inAmountInput
                        .isLoadingCurrentBalanceNetworkFee &&
                      !swapState.inAmountInput.hasErrorWithCurrentBalanceQuote
                      ? "bg-wosmongton-100/20"
                      : "bg-transparent"
                  )}
                  disabled={
                    !swapState.inAmountInput.balance ||
                    swapState.inAmountInput.balance.toDec().isZero() ||
                    swapState.inAmountInput.notEnoughBalanceForMax
                  }
                  isLoading={false}
                  loadingText={t("swap.MAX")}
                  classes={{
                    spinner: "!h-3 !w-3",
                    spinnerContainer: "!gap-1",
                  }}
                  onClick={() => swapState.inAmountInput.toggleMax()}
                >
                  {t("swap.MAX")}
                </Button>
              </Tooltip>
            </div>
          </div>
          <div className="mt-3 flex place-content-between items-center">
            <div className="flex w-full flex-col items-center">
              <input
                ref={fromAmountInputEl}
                type="number"
                className={classNames(
                  "w-full bg-transparent text-center text-white-full placeholder:text-white-disabled focus:outline-none md:text-subtitle1",
                  "text-h2 font-h2 md:font-subtitle1"
                )}
                placeholder="0"
                onChange={(e) => {
                  e.preventDefault();
                  if (e.target.value.length <= (isMobile ? 19 : 26)) {
                    swapState.inAmountInput.setAmount(e.target.value);
                  }
                }}
                value={swapState.inAmountInput.inputAmount}
              />
              <span
                className={classNames(
                  "subtitle1 md:caption whitespace-nowrap text-osmoverse-300 transition-opacity",
                  !swapState.inAmountInput.fiatValue ||
                    swapState.inAmountInput.fiatValue.toDec().isZero()
                    ? "opacity-0"
                    : "opacity-100"
                )}
              >{`≈ ${
                swapState.inAmountInput.fiatValue &&
                swapState.inAmountInput.fiatValue.toString().length > 15
                  ? formatPretty(swapState.inAmountInput.fiatValue)
                  : swapState.inAmountInput.fiatValue?.toString() ?? "0"
              }`}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex place-content-between items-center text-body1">
          <div className="flex w-full flex-col">
            <div>
              <span
                className={classNames(
                  "w-full bg-transparent text-white-full focus:outline-none"
                )}
              >{`When ${tokenOutDenom} price is at `}</span>
              <span
                className={classNames(
                  "w-full bg-transparent text-wosmongton-300 focus:outline-none "
                )}
              >{`$${formatPretty(swapState.priceState.price)}`}</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-row place-content-between items-center rounded-xl border border-osmoverse-700 py-3 px-6">
          <div className="h-full">
            <span>{`${swapState.priceState.percentAdjusted
              .mul(new Dec(100))
              .round()
              .abs()}% `}</span>
            <span className="text-osmoverse-400">below current price</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {useMemo(
              () =>
                percentAdjustmentOptions.map(({ label, value }) => (
                  <button
                    className="rounded-xl border border-osmoverse-700 py-1 px-3 text-white-full text-wosmongton-200"
                    key={`limit-price-adjust-${label}`}
                    onClick={() =>
                      swapState.priceState.adjustByPercentage(value.neg())
                    }
                  >
                    {label}
                  </button>
                )),
              [swapState.priceState]
            )}
          </div>
        </div>
        <Button
          disabled={false}
          isLoading={false}
          loadingText={"Loading..."}
          onClick={swapState.placeLimit}
        >
          {account?.walletStatus === WalletStatus.Connected ||
          isSwapToolLoading ? (
            "Place Order"
          ) : (
            <h6 className="flex items-center gap-3">
              <Icon id="wallet" className="h-6 w-6" />
              {t("connectWallet")}
            </h6>
          )}
        </Button>
      </div>
    );
  }
);
