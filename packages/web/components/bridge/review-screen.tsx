import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { CoinPretty, PricePretty } from "@keplr-wallet/unit";
import { getShortAddress, isNil } from "@osmosis-labs/utils";
import Image from "next/image";
import Link from "next/link";
import { FunctionComponent } from "react";
import { useMeasure } from "react-use";

import { Icon } from "~/components/assets";
import { ChainLogo } from "~/components/assets/chain-logo";
import { Button } from "~/components/ui/button";
import { useTranslation, useWindowSize } from "~/hooks";
import { BridgeChainWithDisplayInfo } from "~/server/api/routers/bridge-transfer";
import { api } from "~/utils/trpc";

import {
  BridgeProviderDropdownRow,
  EstimatedTimeRow,
  ExpandDetailsControlContent,
  NetworkFeeRow,
  ProviderFeesRow,
  TotalFeesRow,
} from "./quote-detail";
import { BridgeQuote } from "./use-bridge-quotes";
import { SupportedAsset } from "./use-bridges-supported-assets";

interface ConfirmationScreenProps {
  direction: "deposit" | "withdraw";
  selectedDenom: string;

  fromChain: BridgeChainWithDisplayInfo;
  toChain: BridgeChainWithDisplayInfo;

  fromAsset: SupportedAsset;
  toAsset: SupportedAsset;

  fromAddress: string;
  toAddress: string;

  fromWalletIcon: string;
  toWalletIcon: string;

  quote: BridgeQuote;

  onCancel: () => void;
  onConfirm: () => void;
}

export const ReviewScreen: FunctionComponent<ConfirmationScreenProps> = ({
  direction,
  selectedDenom,

  fromChain,
  toChain,

  fromAsset,
  toAsset,

  fromAddress,
  toAddress,

  fromWalletIcon,
  toWalletIcon,

  quote,

  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const { data: assetsInOsmosis } =
    api.edge.assets.getCanonicalAssetWithVariants.useQuery(
      {
        findMinDenomOrSymbol: selectedDenom!,
      },
      {
        enabled: !isNil(selectedDenom),
        cacheTime: 10 * 60 * 1000, // 10 minutes
        staleTime: 10 * 60 * 1000, // 10 minutes
      }
    );

  // Find the asset variant or default to the first asset in the list for display metadata
  const fromVariantAsset =
    assetsInOsmosis?.find(
      (asset) => asset.coinMinimalDenom === fromAsset.address
    ) ?? assetsInOsmosis?.[0];
  const toVariantAsset =
    assetsInOsmosis?.find(
      (asset) => asset.coinMinimalDenom === toAsset.address
    ) ?? assetsInOsmosis?.[0];

  return (
    <div className="flex w-full flex-col gap-1 p-4 md:p-2">
      <div className="pb-6 text-center text-h5 font-h5 1.5lg:pb-3 md:text-h6 md:font-h6">
        {t(
          direction === "withdraw"
            ? "transfer.confirmWithdrawTo"
            : "transfer.confirmDepositTo",
          { chain: toChain.prettyName }
        )}
      </div>
      <p className="body1 1.5lg:caption pb-3 text-center text-osmoverse-400">
        {t(
          direction === "withdraw"
            ? "transfer.reviewWithdrawP"
            : "transfer.reviewDepositP"
        )}
      </p>
      {quote.selectedQuote && (
        <AssetBox
          type="from"
          assetImageUrl={fromVariantAsset?.coinImageUrl ?? "/"}
          chain={fromChain}
          address={fromAddress}
          walletImageUrl={fromWalletIcon}
          value={quote.selectedQuote.quote.input.fiatValue}
          coin={quote.selectedQuote.quote.input.amount}
        />
      )}
      <TransferDetails {...quote} fromDisplayChain={fromChain} />
      {quote.selectedQuote && (
        <AssetBox
          type="to"
          assetImageUrl={toVariantAsset?.coinImageUrl ?? "/"}
          chain={toChain}
          address={toAddress}
          walletImageUrl={toWalletIcon}
          value={quote.selectedQuote.expectedOutputFiat}
          coin={quote.selectedQuote.expectedOutput}
        />
      )}
      <div className="flex w-full items-center gap-3 py-3">
        <Button
          className="w-full md:h-12"
          variant="secondary"
          onClick={onCancel}
          disabled={quote.isTxPending}
        >
          <div className="md:subtitle1 text-h6 font-h6">
            {t("transfer.cancel")}
          </div>
        </Button>
        <Button
          isLoading={quote.isTxPending}
          className="w-full md:h-12"
          onClick={onConfirm}
          disabled={!quote.userCanInteract}
        >
          <div className="md:subtitle1 text-h6 font-h6">
            {t("transfer.confirm")}
          </div>
        </Button>
      </div>
      <Link
        href="/disclaimer#providers-and-bridge-disclaimer"
        target="_blank"
        className="mx-auto text-xs font-semibold text-wosmongton-100 hover:text-rust-200"
      >
        {t("disclaimer")}
      </Link>
    </div>
  );
};

const AssetBox: FunctionComponent<{
  type: "from" | "to";
  assetImageUrl: string;
  address: string;
  chain: BridgeChainWithDisplayInfo;
  walletImageUrl: string;
  value: PricePretty;
  coin: CoinPretty;
}> = ({ type, assetImageUrl, chain, address, walletImageUrl, value, coin }) => {
  const { t } = useTranslation();
  const { isMobile } = useWindowSize();

  const ChainAndWallet = isMobile ? (
    <div className="caption flex gap-2 px-3 pb-3 pt-1 text-osmoverse-300">
      {t(type === "from" ? "transfer.from" : "transfer.to")}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ChainLogo
            prettyName={chain.prettyName}
            color={chain.color}
            logoUri={chain.logoUri}
            size="xs"
          />{" "}
          <span>{chain.prettyName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Image
            alt="wallet image"
            src={walletImageUrl}
            width={16}
            height={16}
          />
          <div className="text-wosmongton-200">
            {getShortAddress(address, { prefixLength: 12 })}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex place-content-between items-center px-6 pb-3 pt-1">
      <div className="flex items-center gap-2">
        {t(type === "from" ? "transfer.from" : "transfer.to")}{" "}
        <ChainLogo
          prettyName={chain.prettyName}
          color={chain.color}
          logoUri={chain.logoUri}
        />{" "}
        <span>{chain.prettyName}</span>
      </div>
      <div className="flex items-center gap-2">
        <Image alt="wallet image" src={walletImageUrl} width={24} height={24} />
        <div className="body1 text-wosmongton-200">
          {getShortAddress(address)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-osmoverse-700">
      <div className="flex place-content-between items-center px-6 pt-4 pb-2 md:px-3 md:pt-2 md:pb-1">
        <div className="flex items-center gap-3">
          <Image
            alt="token image"
            src={assetImageUrl}
            width={isMobile ? 32 : 48}
            height={isMobile ? 32 : 48}
          />
          <div className="md:flex md:flex-col md:gap-1">
            <div className="md:body2 text-h6 font-h6">
              {t(type === "from" ? "transfer.transfer" : "transfer.receive", {
                denom: isMobile ? "" : coin.denom,
              })}
            </div>
            {isMobile && (
              <div className="caption text-osmoverse-300">{coin.denom}</div>
            )}
          </div>
        </div>
        <div className="text-right md:flex md:flex-col md:gap-1">
          <div className="subtitle1 md:body2">
            {type === "to" && "~"} {value.toString()}
          </div>
          <div className="body1 md:caption text-osmoverse-300">
            {type === "to" && "~"} {coin.trim(true).toString()}
          </div>
        </div>
      </div>
      <div className="h-[1px] w-full self-center bg-osmoverse-700" />
      {ChainAndWallet}
    </div>
  );
};

/** Assumes the first provider in the list is the selected provider. */
const TransferDetails: FunctionComponent<
  BridgeQuote & { fromDisplayChain: BridgeChainWithDisplayInfo }
> = (quote) => {
  const [detailsRef, { height: detailsHeight, y: detailsOffset }] =
    useMeasure<HTMLDivElement>();
  const { t } = useTranslation();
  const { isMobile } = useWindowSize();
  const { selectedQuote, fromDisplayChain } = quote;

  if (!selectedQuote) return null;

  const { estimatedTime } = selectedQuote;
  const estTime = estimatedTime.humanize();
  const collapsedHeight = isMobile ? 46 : 74;

  return (
    <Disclosure>
      {({ open }) => (
        <div
          className="flex flex-col gap-3 overflow-hidden px-6 transition-height duration-300 ease-inOutBack md:px-3"
          style={{
            height: open
              ? (detailsHeight + detailsOffset ?? 288) + collapsedHeight + 20 // collapsed height
              : collapsedHeight,
          }}
        >
          <DisclosureButton className="md:caption flex place-content-between items-center py-3 md:py-2">
            {open ? (
              <div className="subtitle1">{t("transfer.transferDetails")}</div>
            ) : (
              <div className="flex items-center gap-4 md:gap-1.5 md:text-osmoverse-300">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-osmoverse-700 md:h-8 md:w-8">
                  <Icon id="down-arrow" className="md:h-4 md:w-4" />
                </div>
                <div className="flex items-center gap-1">
                  <Icon id="stopwatch" className="h-4 w-4 text-osmoverse-400" />
                  <p>{estTime}</p>
                </div>
              </div>
            )}
            <ExpandDetailsControlContent
              warnUserOfPriceImpact={quote.warnUserOfPriceImpact}
              warnUserOfSlippage={quote.warnUserOfSlippage}
              selectedQuoteUpdatedAt={quote.selectedQuoteUpdatedAt}
              refetchInterval={quote.refetchInterval}
              selectedQuote={selectedQuote}
              open={open}
            />
          </DisclosureButton>
          <DisclosurePanel ref={detailsRef} className="flex flex-col gap-3">
            <BridgeProviderDropdownRow
              successfulQuotes={quote.successfulQuotes}
              setSelectedBridgeProvider={quote.setSelectedBridgeProvider}
              isRefetchingQuote={quote.isRefetchingQuote}
              selectedQuote={selectedQuote}
            />
            <EstimatedTimeRow
              isRefetchingQuote={quote.isRefetchingQuote}
              selectedQuote={selectedQuote}
            />
            <ProviderFeesRow
              isRefetchingQuote={quote.isRefetchingQuote}
              selectedQuote={selectedQuote}
            />
            <NetworkFeeRow
              isRefetchingQuote={quote.isRefetchingQuote}
              selectedQuote={selectedQuote}
              fromChainName={fromDisplayChain.prettyName}
            />
            <TotalFeesRow
              isRefetchingQuote={quote.isRefetchingQuote}
              selectedQuote={selectedQuote}
            />
          </DisclosurePanel>
        </div>
      )}
    </Disclosure>
  );
};