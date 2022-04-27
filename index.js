const { Bee, Utils } = require('@ethersphere/bee-js')
const { base32 } = require('multiformats/bases/base32')
const { base58btc } = require('multiformats/bases/base58')
const crypto = require('crypto')

const length = 8

// epoch is a month long period
const currentEpoch = Math.floor(Date.now() / 1000 / 60 / 60 / 24 / 30)
// const currentEpoch = Math.floor(Date.now() / 1000 / 60)
const previousEpoch = currentEpoch - 1

const bee = new Bee('https://api.gateway.ethswarm.org')
// const bee = new Bee('http://localhost:1633')
const defaultPostageStampId = '0000000000000000000000000000000000000000000000000000000000000000'
// const defaultPostageStampId = 'bca338d0ce716ab39daac0808dd203bc4df01bbd5517b1f8f79fe5945d8ca8cc'
const randomBuffer = crypto.randomBytes(32)

// this is for namespacing
const appName = 'shortcode'

function calculateCost(num) {
    const pricePerChunk = 0.0000001
    const price = num * pricePerChunk
    const bytesPerSec = Math.pow(2, 32)
    const pollTime = Math.floor(num * 32 / bytesPerSec)
    return {
        price,
        pollTime,
    }
}

function stats() {
    for (let length = 5; length <= 10; length++) {
        const start = 32 - length
        const randomBase32 = base32.baseEncode(randomBuffer.slice(start))
        const randomBase58 = base58btc.baseEncode(randomBuffer.slice(start))
        const bits = 8 * length
        const num = Math.pow(2, 8 * length)
        const cost = calculateCost(num)
        console.log({ length, randomBase32, randomBase58, bits, num, cost })
    }
}

function makeIndexString(random, epoch) {
    return `${appName}:${random.toString('hex')}:${epoch}`
}

async function readEpoch(random, epoch) {
    const indexString = makeIndexString(random, epoch)
    const index = Utils.keccak256Hash(indexString)
    const socWriter = bee.makeSOCWriter(index)
    const identifier = index
    const soc = await socWriter.download(identifier)
    return soc
}

async function readCurrentOrPrevious(random) {
    try {
        const soc = await readEpoch(random, currentEpoch)
        return soc
    } catch {
        const soc = await readEpoch(random, previousEpoch)
        return soc
    }
}

async function read(code) {
    const random = Buffer.from(base58btc.baseDecode(code))
    const soc = await readCurrentOrPrevious(random)
    const payload = soc.payload()
    try {
        const text = new TextDecoder().decode(payload)
        console.debug({ code, text })
    } catch {
        console.debug({ code, payload })
    }
}

async function write(msg) {
    const random = randomBuffer.slice(0, length)
    const indexString = makeIndexString(random, currentEpoch)
    const index = Utils.keccak256Hash(indexString)
    const code = base58btc.baseEncode(random)
    const socWriter = bee.makeSOCWriter(index)
    const data = new TextEncoder().encode(msg)
    const identifier = index
    const ref = await socWriter.upload(defaultPostageStampId, identifier, data)
    console.debug({ ref, code, indexString })
}

const functions = {
    'read': read,
    'write': write,
}

const action = functions[process.argv[2]] || stats
action(process.argv[3])
