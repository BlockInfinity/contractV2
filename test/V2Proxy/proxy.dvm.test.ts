/*

  Copyright 2021 BlockInfinity GmbH; adapeted from 2020 DODO ZOO.
  SPDX-License-Identifier: Apache-2.0

*/

import BigNumber from "bignumber.js";
import { decimalStr, MAX_UINT256, mweiStr } from '../utils/Converter';
import { logGas } from '../utils/Log';
import { ProxyContext, getProxyContext } from '../utils/ProxyContextV2';
import { assert } from 'chai';
import * as contracts from '../utils/Contracts';
import { Contract } from 'web3-eth-contract';

const fs = require('fs');
const numOfTrades = 3;
// const poolParameter
// const realPriceRandomFunction Parameter,

const startPrice = 120;
const endPrice = 80;
const realPrices = initializeRealPrices(numOfTrades, startPrice, endPrice);
const numOfTokenInPool = [0];
const numOfUsdcInPool = [0];
const params = null;
let dvm;
let usdc;
let tao;
// const trader = accounts[0]; // Truffle-provided accounts (via HD wallet provider)

let lp: string;
let project: string;
let trader: string;

let config = {
	lpFeeRate: decimalStr("0.003"),
	k: decimalStr("0.9"),
	i: "1",
};

async function init(ctx: ProxyContext): Promise<void> {
	lp = ctx.SpareAccounts[0];
	project = ctx.SpareAccounts[1];
	trader = ctx.SpareAccounts[2];

	await ctx.mintTestToken(lp, ctx.DODO, decimalStr("1000000"));
	await ctx.mintTestToken(project, ctx.DODO, decimalStr("1000000"));

	await ctx.mintTestToken(lp, ctx.USDT, mweiStr("50000000"));
	await ctx.mintTestToken(project, ctx.USDT, mweiStr("50000000"));

	await ctx.mintTestToken(lp, ctx.USDC, mweiStr("50000000"));
	await ctx.mintTestToken(project, ctx.USDC, mweiStr("50000000"));

	await ctx.approveProxy(lp);
	await ctx.approveProxy(project);
	await ctx.approveProxy(trader);

	await ctx.mintTestToken(trader, ctx.USDT, decimalStr("50000000"));
	await ctx.mintTestToken(trader, ctx.USDC, decimalStr("50000000"));
}

async function initCreateDVM(ctx: ProxyContext, token0: string, token1: string, token0Amount: string, token1Amount: string, ethValue: string, i: string): Promise<string> {
	let PROXY = ctx.DODOProxyV2;
	await PROXY.methods.createDODOVendingMachine(
		token0,
		token1,
		token0Amount,
		token1Amount,
		config.lpFeeRate,
		i,
		config.k,
		false,
		Math.floor(new Date().getTime() / 1000 + 60 * 10)
	).send(ctx.sendParam(project, ethValue));
	if (token0 == '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') token0 = ctx.WETH.options.address;
	if (token1 == '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') token1 = ctx.WETH.options.address;
	var addr = await ctx.DVMFactory.methods._REGISTRY_(token0, token1, 0).call();
	return addr;
}


describe("DODOProxyV2.0", () => {
	let snapshotId: string;
	let ctx: ProxyContext;
	let dvm_DODO_USDT: string;
	let dvm_USDT_USDC: string;
	let dvm_WETH_USDT: string;
	let dvm_WETH_USDC: string;
	let DVM_DODO_USDT: Contract;
	let DVM_USDT_USDC: Contract;
	let DVM_WETH_USDT: Contract;
	let DVM_WETH_USDC: Contract;

	before(async () => {
		let ETH = await contracts.newContract(
			contracts.WETH_CONTRACT_NAME
		);
		ctx = await getProxyContext(ETH.options.address);
		await init(ctx);
		dvm_DODO_USDT = await initCreateDVM(ctx, ctx.DODO.options.address, ctx.USDT.options.address, decimalStr("100000"), mweiStr("20000"), "0", mweiStr("0.2"));
		DVM_DODO_USDT = contracts.getContractWithAddress(contracts.DVM_NAME, dvm_DODO_USDT);
		dvm_USDT_USDC = await initCreateDVM(ctx, ctx.USDT.options.address, ctx.USDC.options.address, mweiStr("5000000"), mweiStr("50000"), "0", config.i);
		DVM_USDT_USDC = contracts.getContractWithAddress(contracts.DVM_NAME, dvm_USDT_USDC);
		dvm_WETH_USDT = await initCreateDVM(ctx, '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', ctx.USDT.options.address, decimalStr("5"), mweiStr("3000"), "5", mweiStr("600"));
		DVM_WETH_USDT = contracts.getContractWithAddress(contracts.DVM_NAME, dvm_WETH_USDT);
		dvm_WETH_USDC = await initCreateDVM(ctx, '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', ctx.USDC.options.address, decimalStr("5"), mweiStr("3000"), "5", mweiStr("600"));
		DVM_WETH_USDC = contracts.getContractWithAddress(contracts.DVM_NAME, dvm_WETH_USDC);
		console.log("dvm_DODO_USDT:", dvm_DODO_USDT);
		console.log("dvm_USDT_USDC:", dvm_USDT_USDC);
		console.log("dvm_WETH_USDT:", dvm_WETH_USDT);
		console.log("dvm_WETH_USDC:", dvm_WETH_USDC);

		// TODO: change to correct dvm and token contracts
		dvm = DVM_USDT_USDC;
		usdc = ctx.USDC;
		tao = ctx.USDT;
	});

	beforeEach(async () => {
		snapshotId = await ctx.EVM.snapshot();
	});

	afterEach(async () => {
		await ctx.EVM.reset(snapshotId);
	});

	describe("DODOProxy", () => {
		it("benchmarks", async () => {

			for (let i = 0; i < numOfTrades; i++) {
				const tradeQuantity = await getQuantity(ctx, dvm, trader, realPrices[i]);
				const tradeResult = await trade(ctx, dvm, trader, tradeQuantity);

				// Save tradeResult
                console.log(tradeQuantity)
                console.log(tradeResult)
				numOfTokenInPool.push(numOfTokenInPool[i] + tradeResult.quoteGained);
				numOfUsdcInPool.push(numOfUsdcInPool[i] + tradeResult.baseGained);
			}
            console.log('Saving to CSV file.');
            console.log(numOfTokenInPool)
			// Save to CSV
            const headerLine = 'realPrices,numOfTokenInPool,numOfUsdcInPool';
            const contentLines = Array.from(Array(realPrices.length).keys()).map(i => `${realPrices[i]},${numOfTokenInPool[i]},${numOfUsdcInPool[i]}`);
            console.log(contentLines)
            const csv = headerLine + "\n" + contentLines.join("\n");
			fs.writeFileSync(resultFileName(numOfTrades, startPrice, endPrice), csv);
		});
	});
});

/**
 * dvm: Contract
 * trader: address
 * price: int; price = amount base / amount quote
 */
async function getQuantity(ctx, dvm, trader, price) {
	const UNDERFLOW_PROTECTOR = 10000;
	let priceOfQueriedAmount = 1;
	let payAmount = UNDERFLOW_PROTECTOR;

	// Try to sell 1 base (buying quote) to see whether the asymptotic price is above or below the
	// intended price.
	const {receiveQuoteAmount, mtFee} = await dvm.methods.querySellBase(trader, UNDERFLOW_PROTECTOR).call();
	const mode = receiveQuoteAmount/UNDERFLOW_PROTECTOR > price ? 'sell' : 'buy'; // Sell or buy quote (not base).
	const queryFunction = mode == 'sell' ? dvm.methods.querySellQuote : dvm.methods.querySellBase;

    let i = 1000;
	while(true) {
		i--;
		if(i < 0) {
            console.error('Too many loop iterations.');
			process.exit(1);
        }
		if(price > priceOfQueriedAmount)
			payAmount = 1.11*payAmount;
		else
			payAmount = 0.9*payAmount;
		payAmount = Math.floor(payAmount)
        console.log(`mode: ${mode}`);
        console.log(`payAmount: ${payAmount}`);
        if(payAmount < UNDERFLOW_PROTECTOR)
            return 0;

		const {receiveQuoteAmount, mtFee} = await queryFunction(trader, payAmount.toString()).call();
        if(receiveQuoteAmount == 0) {
            console.error('receiveQuoteAmount is zero.');
            process.exit(1);
        }
        console.log(`receiveQuoteAmount: ${receiveQuoteAmount}`);
		priceOfQueriedAmount = (payAmount - mtFee) / receiveQuoteAmount;

		// Check whether the prices are approximately equal.
        console.log(`price: ${price}`)
        console.log(`priceOfQueriedAmount: ${priceOfQueriedAmount}`)
        console.log(`Precision of price: ${Math.abs(price - priceOfQueriedAmount)/price}`)
		if(Math.abs(price - priceOfQueriedAmount)/price < 0.01)
			return (mode == 'sell' ? -1 : 1) * receiveQuoteAmount;
	}

    console.error('Precision failure.');
    process.exit(1);
}

// https://gist.github.com/nicolashery/5885280
function randomExponential(rate, randomUniform) {
	// http://en.wikipedia.org/wiki/Exponential_distribution#Generating_exponential_variates
	rate = rate || 1;

	// Allow to pass a random uniform value or function
	// Default to Math.random()
	var U = randomUniform;
	if (typeof randomUniform === "function") U = randomUniform();
	if (!U) U = Math.random();

	return -Math.log(U) / rate;
}

function seasonalTrend(numOfTrades, startPrice, endPrice) {
    let trend = new Array(numOfTrades);
    for (let i = 0; i < numOfTrades; i++) {
        trend[i] = i * ((startPrice - endPrice) / numOfTrades);
    }
    return trend;
}

function initializeRealPrices(numOfTrades, startPrice, endPrice) {
    let realPrices = new Array(numOfTrades);
    for (let i = 0; i < numOfTrades; i++) {
        realPrices[i] =
            /*randomExponential(1, false) * */
                (startPrice - seasonalTrend(numOfTrades, startPrice, endPrice)[i]);
    }
    return realPrices;
}

function resultFileName(numOfTrades, startPrice, endPrice) {
	return `${Date.now()}_${numOfTrades}_${startPrice}_${endPrice}`;
}

function initializePool(numOfUsdcInPool, numOfTokenInPool, params) {
	return null;
}

async function trade(ctx, dvm, trader, tradeQuantity) {
    if(tradeQuantity == 0)
        return {
            baseGained: 0,
            quoteGained: 0,
        }

	const {fromToken, toToken} = tradeQuantity > 0 ?
		{fromToken: usdc, toToken: tao} :
		{fromToken: tao, toToken: usdc};

    const poolBasePrior = await usdc.methods.balanceOf(dvm.options.address).call();
    const poolQuotePrior = await tao.methods.balanceOf(dvm.options.address).call();
    console.log(`tradeQuantity: ${tradeQuantity}`)
    console.log(`poolBasePrior: ${poolBasePrior}`)
    console.log(`poolQuotePrior: ${poolQuotePrior}`)

	const dodoPairs = [
		dvm.options.address
	]
	const directions = tradeQuantity > 0 ? 0 : 1;
    console.log(`ctx.DODOProxyV2: ${ctx.DODOProxyV2}`)
    console.log(`ctx.DODOProxyV2.options.address: ${ctx.DODOProxyV2.options.address}`)
    console.log(`trader: ${trader}`)
	await ctx.DODOProxyV2.methods.dodoSwapV2TokenToToken(
		fromToken.options.address,
		toToken.options.address,
		tradeQuantity,
		0,
		dodoPairs,
		directions,
		false,
		Math.floor(new Date().getTime() / 1000 + 60 * 10)
	).send(ctx.sendParam(trader));

    const poolBasePosterior = await usdc.methods.balanceOf(dvm.options.address).call();
    const poolQuotePosterior = await tao.methods.balanceOf(dvm.options.address).call();
    console.log(`poolBasePosterior: ${poolBasePosterior}`)
    console.log(`poolQuotePosterior: ${poolQuotePosterior}`)

	return {
		baseGained: poolBasePosterior - poolBasePrior,
		quoteGained: poolQuotePosterior - poolQuotePrior,
	};
}

