import { WalletStatus } from "@cosmos-kit/core";
import { Dec, IntPretty, PricePretty } from "@keplr-wallet/unit";
import { NoRouteError, NotEnoughLiquidityError } from "@osmosis-labs/pools";
import { DEFAULT_VS_CURRENCY } from "@osmosis-labs/server";
import { ellipsisText, isNil } from "@osmosis-labs/utils";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import Image from "next/image";
import {
  FunctionComponent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMeasure } from "react-use";

import { Icon } from "~/components/assets";
import { Spinner } from "~/components/loaders";
import { SkeletonLoader } from "~/components/loaders/skeleton-loader";
import { tError } from "~/components/localization";
import { SplitRoute } from "~/components/swap-tool/split-route";
import { Button } from "~/components/ui/button";
import { EventName, EventPage } from "~/config";
import {
  useAmplitudeAnalytics,
  useDisclosure,
  useFeatureFlags,
  useOneClickTradingSession,
  useSlippageConfig,
  useTranslation,
  useWalletSelect,
  useWindowSize,
} from "~/hooks";
import { useBridge } from "~/hooks/bridge";
import { useSwap } from "~/hooks/use-swap";
import { useGlobalIs1CTIntroModalScreen } from "~/modals";
import { ReviewSwapModal } from "~/modals/review-swap";
import { TokenSelectModalLimit } from "~/modals/token-select-modal-limit";
import { useStore } from "~/stores";
import { formatPretty } from "~/utils/formatter";

export interface SwapToolProps {
  fixedWidth?: boolean;
  useOtherCurrencies: boolean | undefined;
  useQueryParams: boolean | undefined;
  onRequestModalClose?: () => void;
  swapButton?: React.ReactElement;
  initialSendTokenDenom?: string;
  initialOutTokenDenom?: string;
  page: EventPage;
  forceSwapInPoolId?: string;
  onSwapSuccess?: (params: {
    sendTokenDenom: string;
    outTokenDenom: string;
  }) => void;
}

export const AltSwapTool: FunctionComponent<SwapToolProps> = observer(
  ({
    fixedWidth,
    useOtherCurrencies,
    useQueryParams,
    onRequestModalClose,
    swapButton,
    initialSendTokenDenom,
    initialOutTokenDenom,
    page,
    forceSwapInPoolId,
    onSwapSuccess,
  }) => {
    const { chainStore, accountStore } = useStore();
    const { t } = useTranslation();
    const { chainId } = chainStore.osmosis;
    const { isMobile } = useWindowSize();
    const { logEvent } = useAmplitudeAnalytics();
    const { isLoading: isWalletLoading, onOpenWalletSelect } =
      useWalletSelect();
    const featureFlags = useFeatureFlags();
    const [, setIs1CTIntroModalScreen] = useGlobalIs1CTIntroModalScreen();
    const { isOneClickTradingEnabled } = useOneClickTradingSession();
    const [isSendingTx, setIsSendingTx] = useState(false);
    const { fiatRampSelection } = useBridge();

    const account = accountStore.getWallet(chainId);
    const slippageConfig = useSlippageConfig();

    const swapState = useSwap({
      initialFromDenom: initialSendTokenDenom,
      initialToDenom: initialOutTokenDenom,
      useOtherCurrencies,
      useQueryParams,
      forceSwapInPoolId,
      maxSlippage: slippageConfig.slippage.toDec(),
    });

    // const manualSlippageInputRef = useRef<HTMLInputElement | null>(null);
    const [
      estimateDetailsContentRef,
      { height: estimateDetailsContentHeight, y: estimateDetailsContentOffset },
    ] = useMeasure<HTMLDivElement>();

    // out amount less slippage calculated from slippage config
    const { outAmountLessSlippage, outFiatAmountLessSlippage } = useMemo(() => {
      // Compute ratio of 1 - slippage
      const oneMinusSlippage = new Dec(1).sub(slippageConfig.slippage.toDec());

      // Compute out amount less slippage
      const outAmountLessSlippage =
        swapState.quote && swapState.toAsset
          ? new IntPretty(swapState.quote.amount.toDec().mul(oneMinusSlippage))
          : undefined;

      // Compute out fiat amount less slippage
      const outFiatAmountLessSlippage = swapState.tokenOutFiatValue
        ? new PricePretty(
            DEFAULT_VS_CURRENCY,
            swapState.tokenOutFiatValue?.toDec().mul(oneMinusSlippage)
          )
        : undefined;

      return { outAmountLessSlippage, outFiatAmountLessSlippage };
    }, [
      swapState.quote,
      swapState.toAsset,
      slippageConfig.slippage,
      swapState.tokenOutFiatValue,
    ]);

    const routesVisDisclosure = useDisclosure();

    const [showQuoteDetails, setShowEstimateDetails] = useState(false);

    /** User has input and there is enough liquidity and routes for given input. */
    const isQuoteDetailRelevant =
      swapState.inAmountInput.amount &&
      !swapState.inAmountInput.amount.toDec().isZero() &&
      !(swapState.error instanceof NotEnoughLiquidityError) &&
      !(swapState.error instanceof NoRouteError);
    // auto collapse on input clear
    useEffect(() => {
      if (!isQuoteDetailRelevant && !swapState.isQuoteLoading)
        setShowEstimateDetails(false);
    }, [isQuoteDetailRelevant, swapState.isQuoteLoading]);

    // auto focus from amount on token switch
    const fromAmountInputEl = useRef<HTMLInputElement | null>(null);

    const showPriceImpactWarning =
      swapState.quote?.priceImpactTokenOut?.toDec().abs().gt(new Dec(0.1)) ??
      false;

    // token select dropdown
    const [showFromTokenSelectModal, setFromTokenSelectDropdownLocal] =
      useState(false);
    const [showToTokenSelectModal, setToTokenSelectDropdownLocal] =
      useState(false);
    const setOneTokenSelectOpen = useCallback((dropdown: "to" | "from") => {
      if (dropdown === "to") {
        setToTokenSelectDropdownLocal(true);
        setFromTokenSelectDropdownLocal(false);
      } else {
        setFromTokenSelectDropdownLocal(true);
        setToTokenSelectDropdownLocal(false);
      }
    }, []);
    const closeTokenSelectModals = useCallback(() => {
      setFromTokenSelectDropdownLocal(false);
      setToTokenSelectDropdownLocal(false);
    }, []);

    // reivew swap modal
    const [showSwapReviewModal, setShowSwapReviewModal] = useState(false);

    // user action
    const sendSwapTx = () => {
      // // prompt to select wallet insteaad of swapping
      // if (account?.walletStatus !== WalletStatus.Connected) {
      //   return onOpenWalletSelect({
      //     walletOptions: [{ walletType: "cosmos", chainId: chainId }],
      //   });
      // }

      if (!swapState.inAmountInput.amount) return;

      const baseEvent = {
        fromToken: swapState.fromAsset?.coinDenom,
        tokenAmount: Number(swapState.inAmountInput.amount.toDec().toString()),
        toToken: swapState.toAsset?.coinDenom,
        isOnHome: page === "Swap Page",
        isMultiHop: swapState.quote?.split.some(
          ({ pools }) => pools.length !== 1
        ),
        isMultiRoute: (swapState.quote?.split.length ?? 0) > 1,
        valueUsd: Number(
          swapState.inAmountInput.fiatValue?.toDec().toString() ?? "0"
        ),
        feeValueUsd: Number(swapState.totalFee?.toString() ?? "0"),
        page,
        quoteTimeMilliseconds: swapState.quote?.timeMs,
        router: swapState.quote?.name,
      };
      logEvent([EventName.Swap.swapStarted, baseEvent]);
      setIsSendingTx(true);
      swapState
        .sendTradeTokenInTx()
        .then((result) => {
          // onFullfill
          logEvent([
            EventName.Swap.swapCompleted,
            {
              ...baseEvent,
              isMultiHop: result === "multihop",
            },
          ]);

          if (swapState.toAsset && swapState.fromAsset) {
            onSwapSuccess?.({
              outTokenDenom: swapState.toAsset.coinDenom,
              sendTokenDenom: swapState.fromAsset.coinDenom,
            });
          }
        })
        .catch((error) => {
          console.error("swap failed", error);
          if (error instanceof Error && error.message === "Request rejected") {
            // don't log when the user rejects in wallet
            return;
          }
          logEvent([EventName.Swap.swapFailed, baseEvent]);
        })
        .finally(() => {
          setIsSendingTx(false);
          onRequestModalClose?.();
          setShowSwapReviewModal(false);
        });
    };

    const isSwapToolLoading = isWalletLoading || swapState.isQuoteLoading;

    let buttonText: string;
    if (swapState.error) {
      buttonText = t(...tError(swapState.error));
    } else if (showPriceImpactWarning) {
      buttonText = t("swap.buttonError");
    } else if (
      swapState.hasOverSpendLimitError ||
      swapState.hasExceededOneClickTradingGasLimit
    ) {
      buttonText = t("swap.continueAnyway");
    } else {
      buttonText = t("swap.button");
    }

    let warningText: string | ReactNode;
    if (swapState.hasOverSpendLimitError) {
      warningText = (
        <span>
          {t("swap.warning.exceedsSpendLimit")}{" "}
          <Button
            variant="link"
            className="!inline !h-auto !px-0 !py-0 text-wosmongton-300"
            onClick={() => {
              setIs1CTIntroModalScreen("settings-no-back-button");
            }}
          >
            {t("swap.warning.increaseSpendLimit")}
          </Button>
        </span>
      );
    } else if (swapState.hasExceededOneClickTradingGasLimit) {
      warningText = (
        <span>
          {t("swap.warning.exceedsNetworkFeeLimit")}{" "}
          <Button
            variant="link"
            className="!inline !h-auto !px-0 !py-0 text-wosmongton-300"
            onClick={() => {
              setIs1CTIntroModalScreen("settings-no-back-button");
            }}
          >
            {t("swap.warning.increaseNetworkFeeLimit")}
          </Button>
        </span>
      );
    }

    // Only display network fee if it's greater than 0.01 USD
    const isNetworkFeeApplicable = swapState.networkFee?.gasUsdValueToPay
      .toDec()
      .gte(new Dec(0.01));

    const isLoadingMaxButton = useMemo(
      () =>
        featureFlags.swapToolSimulateFee &&
        !isNil(account?.address) &&
        !swapState.inAmountInput.hasErrorWithCurrentBalanceQuote &&
        !swapState.inAmountInput?.balance?.toDec().isZero() &&
        swapState.inAmountInput.isLoadingCurrentBalanceNetworkFee,
      [
        account?.address,
        featureFlags.swapToolSimulateFee,
        swapState.inAmountInput?.balance,
        swapState.inAmountInput.hasErrorWithCurrentBalanceQuote,
        swapState.inAmountInput.isLoadingCurrentBalanceNetworkFee,
      ]
    );

    const showTokenSelectRecommendedTokens = useMemo(
      () => isNil(forceSwapInPoolId),
      [forceSwapInPoolId]
    );

    const isUnsufficentBalance = useMemo(
      () => swapState.error?.message === "Insufficient balance",
      [swapState.error?.message]
    );

    return (
      <>
        <div className="relative flex flex-col gap-6 overflow-hidden">
          <div className="flex flex-col gap-3">
            <div className="relative flex flex-col gap-3">
              <div className="flex rounded-2xl bg-osmoverse-1000 py-2 px-4 transition-all">
                <div className="flex w-full flex-col">
                  <div className="flex items-center justify-between">
                    {swapState.fromAsset && (
                      <div className="flex items-center gap-4 py-3">
                        <Image
                          src={swapState.fromAsset.coinImageUrl ?? ""}
                          alt={`${swapState.fromAsset.coinDenom} icon`}
                          width={48}
                          height={48}
                          className="h-12 w-12"
                        />
                        <button
                          onClick={() => setOneTokenSelectOpen("from")}
                          className="flex flex-col"
                        >
                          <div className="flex items-center gap-1">
                            <h5>{swapState.fromAsset.coinDenom}</h5>
                            <div className="flex h-6 w-6 items-center justify-center">
                              <Icon
                                id="chevron-down"
                                className="h-auto w-4.5 text-osmoverse-400"
                              />
                            </div>
                          </div>
                          <p className="whitespace-nowrap text-osmoverse-300">
                            {swapState.fromAsset.coinName}
                          </p>
                        </button>
                      </div>
                    )}
                    <div className="flex flex-col items-end py-2">
                      <input
                        ref={fromAmountInputEl}
                        type="number"
                        className={classNames(
                          "w-full bg-transparent text-right text-white-full transition-colors placeholder:text-white-disabled focus:outline-none md:text-subtitle1",
                          "text-h5 font-h5 md:font-subtitle1",
                          {
                            "text-rust-300": isUnsufficentBalance,
                          }
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
                          "body1 md:caption whitespace-nowrap text-osmoverse-300 transition-opacity"
                        )}
                      >{`≈ ${formatPretty(
                        swapState.inAmountInput.fiatValue ?? new Dec(0),
                        {
                          maxDecimals: 8,
                        }
                      )}`}</span>
                    </div>
                  </div>
                  {account?.isWalletConnected && (
                    <div className="body2 flex justify-between pb-1">
                      <span className="pt-1.5 text-osmoverse-400">
                        {formatPretty(
                          swapState.inAmountInput.balance ?? new Dec(0)
                        )}{" "}
                        available
                      </span>
                      {swapState.inAmountInput.balance &&
                      swapState.inAmountInput.balance.toDec().gt(new Dec(0)) ? (
                        <button
                          disabled={
                            !swapState.inAmountInput.balance ||
                            swapState.inAmountInput.balance.toDec().isZero() ||
                            swapState.inAmountInput.notEnoughBalanceForMax ||
                            isLoadingMaxButton
                          }
                          onClick={() => swapState.inAmountInput.toggleMax()}
                          className={classNames(
                            "flex h-8 items-center justify-center gap-1 rounded-5xl border border-osmoverse-700 bg-transparent py-1.5 px-3 text-wosmongton-200 transition-colors hover:bg-osmoverse-700 disabled:pointer-events-none disabled:opacity-50",
                            {
                              "text-rust-300": isUnsufficentBalance,
                            }
                          )}
                        >
                          {isLoadingMaxButton && (
                            <Spinner className="h-2.5 w-2.5" />
                          )}
                          Max
                        </button>
                      ) : (
                        <button
                          onClick={fiatRampSelection}
                          className="flex items-center justify-center rounded-5xl bg-wosmongton-700 py-1.5 px-3"
                        >
                          Add funds
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* TODO - move this custom button to our own button component */}
              <button
                className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-[calc(50%-16px)] items-center justify-center rounded-full bg-osmoverse-825"
                onClick={() => swapState.switchAssets()}
              >
                <Icon
                  id="arrows-swap-16"
                  className="h-4 w-4 text-wosmongton-200"
                />
              </button>
              <div className="flex rounded-2xl bg-osmoverse-1000 py-2 px-4 transition-all">
                <div className="flex w-full items-center justify-between">
                  {swapState.toAsset && (
                    <div className="flex items-center gap-4 py-3">
                      <Image
                        src={swapState.toAsset.coinImageUrl ?? ""}
                        alt={`${swapState.toAsset.coinDenom} icon`}
                        width={48}
                        height={48}
                        className="h-12 w-12"
                      />
                      <button
                        onClick={() => setOneTokenSelectOpen("to")}
                        className="flex flex-col"
                      >
                        <div className="flex items-center gap-1">
                          <h5>{swapState.toAsset.coinDenom}</h5>
                          <div className="flex h-6 w-6 items-center justify-center">
                            <Icon
                              id="chevron-down"
                              className="h-auto w-4.5 text-osmoverse-400"
                            />
                          </div>
                        </div>
                        <p className="whitespace-nowrap text-osmoverse-300">
                          {swapState.toAsset.coinName}
                        </p>
                      </button>
                    </div>
                  )}
                  <div className="flex flex-col items-end py-2">
                    <h5
                      className={classNames(
                        "md:subtitle1 whitespace-nowrap text-right transition-opacity",
                        swapState.quote?.amount.toDec().isPositive() &&
                          !swapState.inAmountInput.isTyping &&
                          !swapState.isQuoteLoading
                          ? "text-white-full"
                          : "text-white-disabled",
                        {
                          "opacity-50":
                            isSwapToolLoading ||
                            !swapState.quote ||
                            swapState.inAmountInput.isEmpty,
                        }
                      )}
                    >
                      {formatPretty(
                        swapState.quote?.amount
                          ? swapState.quote.amount.toDec()
                          : new Dec(0)
                      )}
                    </h5>
                    <span className="body1 md:caption whitespace-nowrap text-osmoverse-300 transition-opacity">{`≈ ${formatPretty(
                      swapState.tokenOutFiatValue ?? new Dec(0),
                      {
                        maxDecimals: 8,
                      }
                    )}`}</span>
                  </div>
                </div>
              </div>
            </div>
            <SkeletonLoader
              className={classNames(
                "relative overflow-hidden rounded-lg bg-osmoverse-900 px-4 transition-all duration-300 ease-inOutBack md:px-3",
                showQuoteDetails ? "py-6" : "py-[10px]"
              )}
              style={{
                height: showQuoteDetails
                  ? (estimateDetailsContentHeight +
                      estimateDetailsContentOffset ?? 288) +
                    44 + // collapsed height
                    20 // padding
                  : 44,
              }}
              isLoaded={
                Boolean(swapState.toAsset) &&
                Boolean(swapState.fromAsset) &&
                !swapState.isSpotPriceQuoteLoading
              }
            >
              {/* TODO - move this custom button to our own button component */}
              <button
                className={classNames(
                  "flex w-full place-content-between items-center transition-opacity",
                  {
                    "cursor-pointer": isQuoteDetailRelevant,
                  }
                )}
                onClick={() => {
                  if (isQuoteDetailRelevant)
                    setShowEstimateDetails((show) => !show);
                }}
              >
                <span
                  className={classNames("subtitle2 transition-opacity", {
                    "text-osmoverse-600": !isQuoteDetailRelevant,
                    "opacity-50":
                      swapState.isQuoteLoading ||
                      swapState.inAmountInput.isTyping,
                  })}
                >
                  1{" "}
                  <span title={swapState.fromAsset?.coinDenom}>
                    {ellipsisText(
                      swapState.fromAsset?.coinDenom ?? "",
                      isMobile ? 11 : 20
                    )}
                  </span>{" "}
                  {`≈ ${
                    swapState.toAsset
                      ? formatPretty(
                          swapState.inBaseOutQuoteSpotPrice ?? new Dec(0),
                          {
                            maxDecimals: Math.min(
                              swapState.toAsset.coinDecimals,
                              8
                            ),
                          }
                        )
                      : "0"
                  }`}
                </span>
                <div
                  className={classNames(
                    "flex items-center gap-2 transition-opacity",
                    { "opacity-50": swapState.isQuoteLoading }
                  )}
                >
                  <Icon
                    id="alert-circle"
                    height={24}
                    width={24}
                    className={classNames(
                      "text-rust-500 transition-opacity",
                      showPriceImpactWarning ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Icon
                    id="chevron-down"
                    height={isMobile ? 14 : 18}
                    width={isMobile ? 14 : 18}
                    className={classNames(
                      "text-osmoverse-400 transition-all",
                      showQuoteDetails ? "rotate-180" : "rotate-0",
                      isQuoteDetailRelevant ? "opacity-100" : "opacity-0"
                    )}
                  />
                </div>
              </button>
              <div
                ref={estimateDetailsContentRef}
                className={classNames(
                  "flex flex-col gap-4 pt-5 transition-opacity",
                  fixedWidth ? "w-[94%]" : "w-full md:w-[94%]",
                  { "opacity-50": swapState.isQuoteLoading }
                )}
              >
                {swapState.quote?.priceImpactTokenOut && (
                  <div
                    className={classNames("flex justify-between gap-1", {
                      "text-rust-500": showPriceImpactWarning,
                    })}
                  >
                    <span className="caption">{t("swap.priceImpact")}</span>
                    <span
                      className={classNames(
                        "caption",
                        showPriceImpactWarning
                          ? "text-rust-500"
                          : "text-osmoverse-200"
                      )}
                    >
                      {`-${swapState.quote.priceImpactTokenOut.toString()}`}
                    </span>
                  </div>
                )}
                {swapState.tokenInFeeAmountFiatValue &&
                  swapState.quote?.swapFee && (
                    <div className="flex justify-between">
                      <span className="caption">
                        {t("swap.fee", {
                          fee: swapState.quote.swapFee.toString(),
                        })}
                      </span>
                      <span className="caption text-osmoverse-200">
                        {`≈ ${swapState.tokenInFeeAmountFiatValue ?? "0"} `}
                      </span>
                    </div>
                  )}
                {(swapState.networkFee || swapState.isLoadingNetworkFee) &&
                featureFlags.swapToolSimulateFee &&
                isNetworkFeeApplicable &&
                !swapState.error ? (
                  <div className="flex items-center justify-between">
                    <span className="caption">{t("swap.networkFee")}</span>
                    <SkeletonLoader
                      isLoaded={!swapState.isLoadingNetworkFee}
                      className="min-w-[3rem] leading-[0]"
                    >
                      <span className="caption text-osmoverse-200">
                        {`≈ ${swapState.networkFee?.gasUsdValueToPay ?? "0"} `}
                      </span>
                    </SkeletonLoader>
                  </div>
                ) : undefined}
                {((swapState.tokenInFeeAmountFiatValue &&
                  swapState.quote?.swapFee) ||
                  (swapState.networkFee && !swapState.isLoadingNetworkFee)) &&
                  featureFlags.swapToolSimulateFee &&
                  isNetworkFeeApplicable && (
                    <div className="flex justify-between">
                      <span className="caption">{t("swap.totalFee")}</span>
                      <span className="caption text-osmoverse-200">
                        {`≈ ${new PricePretty(
                          DEFAULT_VS_CURRENCY,
                          swapState.totalFee
                        )} `}
                      </span>
                    </div>
                  )}
                <hr className="text-white-faint" />
                <div className="flex justify-between gap-1">
                  <span className="caption max-w-[140px]">
                    {t("swap.expectedOutput")}
                  </span>
                  <SkeletonLoader
                    className={
                      swapState.isQuoteLoading ? "w-1/4" : "ml-auto w-fit"
                    }
                    isLoaded={!swapState.isQuoteLoading}
                  >
                    <span className="caption whitespace-nowrap text-osmoverse-200">
                      {`≈ ${
                        swapState.quote?.amount
                          ? formatPretty(swapState.quote.amount, {
                              maxDecimals: 8,
                            })
                          : ""
                      }`}
                    </span>
                  </SkeletonLoader>
                </div>
                <div className="flex justify-between gap-1">
                  <span className="caption max-w-[140px]">
                    {t("swap.minimumSlippage", {
                      slippage: slippageConfig.slippage.trim(true).toString(),
                    })}
                  </span>
                  <SkeletonLoader
                    className={
                      swapState.isQuoteLoading ? "w-1/4" : "ml-auto w-fit"
                    }
                    isLoaded={!swapState.isQuoteLoading}
                  >
                    {outAmountLessSlippage &&
                      outFiatAmountLessSlippage &&
                      swapState.toAsset && (
                        <div
                          className={classNames(
                            "caption flex flex-col gap-0.5 text-right text-osmoverse-200"
                          )}
                        >
                          <span className="whitespace-nowrap">
                            {formatPretty(outAmountLessSlippage, {
                              maxDecimals: 8,
                            })}
                          </span>
                          <span>{`≈ ${outFiatAmountLessSlippage || "0"}`}</span>
                        </div>
                      )}
                  </SkeletonLoader>
                </div>
                {!forceSwapInPoolId && (
                  <SplitRoute
                    {...routesVisDisclosure}
                    split={swapState.quote?.split ?? []}
                    isLoading={isSwapToolLoading}
                  />
                )}
              </div>
            </SkeletonLoader>
          </div>
          {!isNil(warningText) && (
            <div
              className={classNames(
                "body2 flex animate-[fadeIn_0.3s_ease-in-out_0s] items-center justify-center rounded-xl border border-rust-600 px-3 py-2 text-center text-rust-500",
                swapState.isLoadingNetworkFee && "animate-pulse"
              )}
            >
              {warningText}
            </div>
          )}
          {swapButton ?? (
            <Button
              disabled={
                isSendingTx ||
                isWalletLoading ||
                (account?.walletStatus === WalletStatus.Connected &&
                  (swapState.inAmountInput.isEmpty ||
                    !Boolean(swapState.quote) ||
                    Boolean(swapState.error) ||
                    account?.txTypeInProgress !== ""))
              }
              isLoading={
                /**
                 * While 1-Click is enabled, display a loading spinner when simulation
                 * is in progress since we don't have a wallet to compute the fee for
                 * us. We need the network fee to be calculated before we can proceed
                 * with the trade.
                 */
                isOneClickTradingEnabled &&
                swapState.isLoadingNetworkFee &&
                !swapState.inAmountInput.isEmpty
              }
              loadingText={buttonText}
              onClick={() => {
                if (account?.walletStatus !== WalletStatus.Connected) {
                  return onOpenWalletSelect({
                    walletOptions: [{ walletType: "cosmos", chainId: chainId }],
                  });
                }

                setShowSwapReviewModal(true);
              }}
            >
              <h6>
                {account?.walletStatus === WalletStatus.Connected ||
                isSwapToolLoading
                  ? buttonText
                  : t("connectWallet")}
              </h6>
            </Button>
          )}
        </div>
        <TokenSelectModalLimit
          headerTitle="Select an asset to sell"
          isOpen={showFromTokenSelectModal}
          onClose={closeTokenSelectModals}
          selectableAssets={swapState.selectableAssets}
          onSelect={useCallback(
            (tokenDenom: string) => {
              // If the selected token is the same as the current "to" token, switch the assets
              if (tokenDenom === swapState.toAsset?.coinDenom) {
                swapState.switchAssets();
              } else {
                swapState.setFromAssetDenom(tokenDenom);
              }

              closeTokenSelectModals();
              fromAmountInputEl.current?.focus();
            },
            [swapState, closeTokenSelectModals]
          )}
          showRecommendedTokens={showTokenSelectRecommendedTokens}
        />
        <TokenSelectModalLimit
          headerTitle="Select an asset to buy"
          isOpen={showToTokenSelectModal}
          onClose={closeTokenSelectModals}
          selectableAssets={swapState.selectableAssets}
          onSelect={useCallback(
            (tokenDenom: string) => {
              // If the selected token is the same as the current "from" token, switch the assets
              if (tokenDenom === swapState.fromAsset?.coinDenom) {
                swapState.switchAssets();
              } else {
                swapState.setToAssetDenom(tokenDenom);
              }

              closeTokenSelectModals();
            },
            [swapState, closeTokenSelectModals]
          )}
          showRecommendedTokens={showTokenSelectRecommendedTokens}
        />
        <ReviewSwapModal
          isOpen={showSwapReviewModal}
          onClose={() => setShowSwapReviewModal(false)}
          swapState={swapState}
          confirmAction={sendSwapTx}
        />
      </>
    );
  }
);