const fs = require('fs');
const numOfTrades = 10;
// const poolParameter
// const realPriceRandomFunction Parameter,

const realPrices = initializeRealPrices(numOfTrades);
const numOfTokenInPool = [100];
const numOfUsdcInPool = [1000];
const pool = initializePool(numOfUsdcInPool, numOfTokenInPool, params)
const usdc = '0x...';
const tao = '0x...';
const ctx; // TODO: ProxyContext
const trader = accounts[0]; // Truffle-provided accounts (via HD wallet provider)

for (let i = 0; i < numOfTrades; i++) {
  let tradeQuantity = await getQuantity(pool, trader, realPrices[i]);

  tradeResult = await trade(pool, trader, tradeQuantity);

  // Save tradeResult
  numOfTokenInPool.push[i+1] = numOfTokenInPool[i] + tradeResult.quoteGained;
  numOfUsdcInPool.push[i+1] = numOfUsdcInPool[i] + tradeResult.baseGained;
}

// Save to CSV
const csv = arrayToCSV(
  {
    realPrices: realPrices,
    numOfTokenInPool: numOfTokenInPool,
    numOfUsdcInPool: numOfUsdcInPool
  });
await fs.writeFile(resultFileName(numOfTrades, startPrice, endPrice), csv);

async function trade(pool, trader, tradeQuantity) {
  const {fromToken, toToken} = tradeQuantity > 0 ? {usdc, tao} : {tao, usdc};
  if(tradeQuantity > 0) {
    // TODO
  } else {
    // TODO
  }

  const dodoPairs = [
    pool.dvm
  ]
  const directions = tradeQuantity > 0 ? 0 : 1;

  await ctx.DODOProxyV2.methods.dodoSwapV2TokenToToken(
    fromToken.options.address,
    toToken.options.address,
    tradeQuantity,
    0,
    dodoPairs,
    directions,
    false,
    Math.floor(new Date().getTime() / 1000 + 60 * 10)
  );
}


/**
* pool = {proxy: Contract, dvm: Contract}
* trader: address
* price: int; price = amount base / amount quote
*/
async function getQuantity(pool, trader, price) {
  const UNDERFLOW_PROTECTOR = 10000;
  let priceOfQueriedAmount = 1;
  let payAmount = 1;

  // Try to sell 1 base (buying quote) to see whether the asymptotic price is above or below the
  // intended price.
  const {receiveQuoteAmount, mtFee} = await pool.dvm.methods.querySellBase(trader, UNDERFLOW_PROTECTOR).call();
  const mode = receiveQuoteAmount/UNDERFLOW_PROTECTOR > price ? 'sell' : 'buy'; // Sell or buy quote (not base).
  const queryFunction = mode == 'sell' ? pool.dvm.methods.querySellQuote : pool.dvm.methods.querySellBase;

  while(true) {
    if(price > priceOfQueriedAmount)
      payAmount = mode == 'sell' ? 2*payAmount : 0.75*payAmount;
    else
      payAmount = mode == 'sell' ? 0.75*payAmount : 2*payAmount;

    const {receiveQuoteAmount, mtFee} = await queryFunction(trader, payAmount).call();
    priceOfQueriedAmount = (payAmount - mtFee) / receiveQuoteAmount;

    // Check whether the prices are approximately equal.
    if(Math.abs(price - priceOfQueriedAmount)/price < 0.0001)
      return (mode == 'sell' ? -1 : 1) * receiveQuoteAmount;
  }
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
    trend[i] = i * ((endPrice - startPrice) / numOfTrades);
  }
  return trend;
}

function initializeRealPrices(numOfTrades, startPrice, endPrice) {
  let realPrices = new Array(numOfTrades);
  for (let i = 0; i < numOfTrades; i++) {
    realPrices[i] = Math.floor(
      randomExponential(1, false) * (endPrice - startPrice) +
        seasonalTrend(numOfTrades, startPrice, endPrice)[i]
    );
  }
  return realPrices;
}


// https://stackoverflow.com/a/46948292
function arrayToCSV(objArray) {
     const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
     let str = `${Object.keys(array[0]).map(value => `"${value}"`).join(",")}` + '\r\n';

     return array.reduce((str, next) => {
         str += `${Object.values(next).map(value => `"${value}"`).join(",")}` + '\r\n';
         return str;
        }, str);
 }

function resultFileName(numOfTrades, startPrice, endPrice) {
  return `${Date.now()}_${numOfTrades}_${startPrice}_${endPrice}`;
}
