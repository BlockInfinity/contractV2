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
const numOfTrades = 20;
// const poolParameter
// const realPriceRandomFunction Parameter,

const startPrice = 1.1;
const endPrice = 0.6;
const realPrices = initializeRealPrices(numOfTrades, startPrice, endPrice);
console.log(realPrices)
const numOfTokenInPool = [new BigNumber(0)];
const numOfUsdcInPool = [new BigNumber(0)];
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
	k: decimalStr("1"),
	i: "1",
};

async function init(ctx: ProxyContext): Promise<void> {
	lp = ctx.SpareAccounts[0];
	project = ctx.SpareAccounts[1];
	trader = ctx.SpareAccounts[2];

	await ctx.mintTestToken(lp, ctx.DODO, decimalStr("1000000"));
	await ctx.mintTestToken(project, ctx.DODO, decimalStr("1000000"));

	await ctx.mintTestToken(lp, ctx.USDT, decimalStr("50000000"));
	await ctx.mintTestToken(project, ctx.USDT, decimalStr("50000000"));

	await ctx.mintTestToken(lp, ctx.USDC, decimalStr("50000000"));
	await ctx.mintTestToken(project, ctx.USDC, decimalStr("50000000"));

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
	let dvm_USDT_DODO: string;
	let dvm_USDT_USDC: string;
	let dvm_WETH_USDT: string;
	let dvm_WETH_USDC: string;
	let DVM_DODO_USDT: Contract;
	let DVM_USDT_DODO: Contract;
	let DVM_USDT_USDC: Contract;
	let DVM_WETH_USDT: Contract;
	let DVM_WETH_USDC: Contract;

	before(async () => {
		let ETH = await contracts.newContract(
			contracts.WETH_CONTRACT_NAME
		);
		ctx = await getProxyContext(ETH.options.address);
		await init(ctx);
		dvm_DODO_USDT = await initCreateDVM(ctx, ctx.DODO.options.address, ctx.USDT.options.address, decimalStr("100000"), decimalStr("100000"), "0", decimalStr("1"));
		DVM_DODO_USDT = contracts.getContractWithAddress(contracts.DVM_NAME, dvm_DODO_USDT);
		dvm_USDT_DODO = await initCreateDVM(ctx, ctx.USDT.options.address, ctx.DODO.options.address, decimalStr("100000"), decimalStr("100000"), "0", decimalStr("1"));
		DVM_USDT_DODO = contracts.getContractWithAddress(contracts.DVM_NAME, dvm_USDT_DODO);
		dvm_USDT_USDC = await initCreateDVM(ctx, ctx.USDC.options.address, ctx.USDT.options.address, decimalStr("100000"), decimalStr("100000"), "0", "1");
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

/*
        it("swap - one jump", async () => {
            await ctx.mintTestToken(trader, ctx.DODO, decimalStr("1000"));
            await ctx.mintTestToken(trader, ctx.USDC, decimalStr("1000"));
            await ctx.mintTestToken(trader, ctx.USDT, decimalStr("1000"));

            var dodoPairs = [
                dvm_DODO_USDT
            ]
            var directions = 0

            await logGas(await ctx.DODOProxyV2.methods.dodoSwapV2TokenToToken(
                ctx.DODO.options.address,
                ctx.USDT.options.address,
                decimalStr("500"),
                1,
                dodoPairs,
                directions,
                false,
                Math.floor(new Date().getTime() / 1000 + 60 * 10)
            ), ctx.sendParam(trader), "swap - one jump first");
        });
*/

        it.skip("swap - one jump", async () => {
            await ctx.mintTestToken(trader, ctx.DODO, decimalStr("1000"));
            await ctx.mintTestToken(trader, ctx.USDC, decimalStr("1000"));
            await ctx.mintTestToken(trader, ctx.USDT, decimalStr("1000"));

            var dodoPairs = [
                dvm_DODO_USDT
            ]
            var directions = 1 // Has to be 0 when swapping in the direction of the pair (DODO → USDT for dvm_DODO_USDT), 1 otherwise.

            await logGas(await ctx.DODOProxyV2.methods.dodoSwapV2TokenToToken(
                ctx.USDT.options.address,
                ctx.DODO.options.address, // Has to be in the direction of the swap, not in the direction of the DVM setup.
                decimalStr("500"),
                1,
                dodoPairs,
                directions,
                false,
                Math.floor(new Date().getTime() / 1000 + 60 * 10)
            ), ctx.sendParam(trader), "swap - one jump first");
        });

		it("benchmarks", async () => {

            const tradeQuantities = [-5000000000, 5000000000];
			for (let i = 0; i < numOfTrades; i++) {
				//const tradeQuantity = await getQuantity(ctx, dvm, trader, realPrices[i]);
                const tradeQuantity = tradeQuantities[i];
				const tradeResult = await trade(ctx, dvm, trader, tradeQuantity, dvm_DODO_USDT);

				// Save tradeResult
				numOfTokenInPool.push(numOfTokenInPool[i].plus(tradeResult.quoteGained));
				numOfUsdcInPool.push(numOfUsdcInPool[i].plus(tradeResult.baseGained));
			}

			// Save to CSV
            const headerLine = 'realPrices,numOfTokenInPool,numOfUsdcInPool';
            const contentLines = Array.from(Array(realPrices.length).keys()).map(i => `${realPrices[i]},${numOfTokenInPool[i]},${numOfUsdcInPool[i]}`);

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

        if(payAmount < UNDERFLOW_PROTECTOR)
            return 0;

		const {receiveQuoteAmount, mtFee} = await queryFunction(trader, payAmount.toString()).call();
        if(receiveQuoteAmount == 0) {
            console.error('receiveQuoteAmount is zero.');
            process.exit(1);
        }

		priceOfQueriedAmount = (payAmount - mtFee) / receiveQuoteAmount;

		// Check whether the prices are approximately equal.
		if(Math.abs(price - priceOfQueriedAmount)/price < 0.01) {
            console.log(`Expected loss: ${payAmount}`)
            console.log(`Expected gain: ${receiveQuoteAmount}`)
			return (mode == 'sell' ? -1 : 1) * payAmount;
        }
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
        trend[i] = startPrice - i * ((startPrice - endPrice) / (numOfTrades-1));
    }
    return trend;
}

function randn_bm() {
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

function initializeRealPrices(numOfTrades, startPrice, endPrice) {
    const realPrices = new Array(numOfTrades);
	const seasonalTrendArr = seasonalTrend(numOfTrades, startPrice, endPrice);
	console.log(seasonalTrendArr)
    for (let i = 0; i < numOfTrades; i++) {
        realPrices[i] = seasonalTrendArr[i] * (1 + .05*randn_bm());
    }
    return realPrices;
}

function resultFileName(numOfTrades, startPrice, endPrice) {
	return `csv/${Date.now()}_${numOfTrades}_${startPrice}_${endPrice}`;
}

function initializePool(numOfUsdcInPool, numOfTokenInPool, params) {
	return null;
}

async function trade(ctx, dvm, trader, tradeQuantity, dvm_DODO_USDT) {
    await ctx.mintTestToken(trader, ctx.DODO, decimalStr("1000"));
    await ctx.mintTestToken(trader, ctx.USDC, decimalStr("1000"));
    await ctx.mintTestToken(trader, ctx.USDT, decimalStr("1000"));

    if(tradeQuantity == 0)
        return {
            baseGained: 0,
            quoteGained: 0,
        }

	const {fromToken, toToken} = tradeQuantity > 0 ?
		{fromToken: usdc, toToken: tao} :
		{fromToken: tao, toToken: usdc};

    const poolBasePrior = new BigNumber(await usdc.methods.balanceOf(dvm.options.address).call());
    const poolQuotePrior = new BigNumber(await tao.methods.balanceOf(dvm.options.address).call());
    console.log(`tradeQuantity: ${tradeQuantity}`)
    console.log(`poolBasePrior: ${poolBasePrior}`)
    console.log(`poolQuotePrior: ${poolQuotePrior}`)

    // BEGINNING: check of view function
    const queryFunction = tradeQuantity < 0 ? dvm.methods.querySellQuote : dvm.methods.querySellBase;
    const {receiveQuoteAmount, mtFee} = await queryFunction(trader, Math.abs(tradeQuantity)).call();
    console.log(`View function output: ${receiveQuoteAmount} | ${mtFee}`)
    // END: check of view function

	const dodoPairs = [
		dvm.options.address
	]
	const directions = tradeQuantity > 0 ? 0 : 1;
	await ctx.DODOProxyV2.methods.dodoSwapV2TokenToToken(
		fromToken.options.address,
		toToken.options.address,
		(new BigNumber(Math.abs(tradeQuantity).toString())).toString(),
		1,
		dodoPairs,
		directions,
		false,
		Math.floor(new Date().getTime() / 1000 + 60 * 10)
	).send(ctx.sendParam(trader));

    const poolBasePosterior = new BigNumber(await usdc.methods.balanceOf(dvm.options.address).call());
    const poolQuotePosterior = new BigNumber(await tao.methods.balanceOf(dvm.options.address).call());
    console.log(`poolBasePosterior: ${poolBasePosterior}`)
    console.log(`poolQuotePosterior: ${poolQuotePosterior}`)

	return {
		baseGained: poolBasePosterior.minus(poolBasePrior),
		quoteGained: poolQuotePosterior.minus(poolQuotePrior),
	};
}

