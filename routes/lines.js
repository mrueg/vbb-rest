import {statSync} from 'node:fs'
import computeEtag from 'etag'
import omit from 'lodash.omit'
import _cliNative from 'cli-native'
const {to: parse} = _cliNative
import serveBuffer from 'serve-buffer'
import _vbbLines from 'vbb-lines'
const {filterByKeys: createFilter} = _vbbLines
import {data as lines, timeModified} from '../lib/vbb-lines.js'
import {toNdjsonBuf} from '../lib/to-ndjson-buf.js'

const JSON_MIME = 'application/json'
const NDJSON_MIME = 'application/x-ndjson'

const asJson = Buffer.from(JSON.stringify(lines), 'utf8')
const asJsonEtag = computeEtag(asJson)
const asNdjson = toNdjsonBuf(Object.entries(lines))
const asNdjsonEtag = computeEtag(asNdjson)

const err = (msg, statusCode = 500) => {
	const err = new Error(msg)
	err.statusCode = statusCode
	return err
}

const linesRoute = (req, res, next) => {
	const q = omit(req.query, ['variants'])
	const variants = req.query.variants && parse(req.query.variants)

	const t = req.accepts([JSON_MIME, NDJSON_MIME])
	if (t !== JSON_MIME && t !== NDJSON_MIME) {
		return next(err(JSON + ' or ' + NDJSON_MIME, 406))
	}

	res.setHeader('Last-Modified', timeModified.toUTCString())

	if (Object.keys(q).length === 0) {
		const data = t === JSON_MIME ? asJson : asNdjson
		const etag = t === JSON_MIME ? asJsonEtag : asNdjsonEtag
		serveBuffer(req, res, data, {timeModified, etag})
	} else {
		const filter = createFilter(q)

		const head = t === JSON_MIME ? '[\n' : ''
		const sep = t === JSON_MIME ? ',\n' : '\n'
		const tail = t === JSON_MIME ? '\n]\n' : '\n'
		let n = 0
		for (let i = 0; i < lines.length; i++) {
			let l = lines[i]
			if (!filter(l)) continue
			if (variants === false) l = {...l, variants: undefined}
			const j = JSON.stringify(l)
			res.write(`${n++ === 0 ? head : sep}${j}`)
		}
		if (n > 0) res.end(tail)
		else res.end(head + tail)
	}
}

linesRoute.openapiPaths = {
	'/lines': {
		get: {
			summary: 'Filters the lines in `vbb-lines`.',
			description: `\
**Filters the lines in [\`vbb-lines\`](https://npmjs.com/package/vbb-lines).**

Instead of receiving a JSON response, you can request [newline-delimited JSON](http://ndjson.org) by sending \`Accept: application/x-ndjson\`.`,
			parameters: [{
				name: 'id',
				in: 'query',
				description: 'Filter by ID.',
				schema: {
					type: 'string',
				},
			}, {
				name: 'name',
				in: 'query',
				description: 'Filter by name.',
				schema: {
					type: 'string',
				},
			}, {
				name: 'operator',
				in: 'query',
				description: 'Filter by operator id. See [`agency.csv`](https://vbb-gtfs.jannisr.de/latest/agency.csv).',
				schema: {
					type: 'string',
				},
			}, {
				name: 'variants',
				in: 'query',
				description: 'Return stops/stations along the line?',
				schema: {
					type: 'boolean',
					default: true,
				},
			}, {
				name: 'mode',
				in: 'query',
				description: 'Filter by mode of transport as in [*Friendly Public Transport Format* `1.2.1`](https://github.com/public-transport/friendly-public-transport-format/blob/1.2.1/spec/readme.md).',
				schema: {
					type: 'string',
				},
			}, {
				name: 'product',
				in: 'query',
				description: 'Filter by [product](https://github.com/public-transport/hafas-client/blob/6/p/vbb/products.js).',
				schema: {
					type: 'string',
				},
			}],
			responses: {
				'2XX': {
					description: 'An array of stops/stations, in the [`vbb-stations@7` format](https://github.com/derhuerst/vbb-stations/blob/7.3.2/readme.md).',
					content: {
						'application/json': {
							schema: {
								type: 'array',
								items: {type: 'object'}, // todo
							},
							// todo: example(s)
						},
					},
				},
			},
		},
	},
}

linesRoute.queryParameters = {
	'id': {
		description: 'Filter by ID.',
		type: 'string',
		defaultStr: '–',
	},
	'name': {
		description: 'Filter by name.',
		type: 'string',
		defaultStr: '–',
	},
	'operator': {
		description: 'Filter by operator id. See [`agency.csv`](https://vbb-gtfs.jannisr.de/latest/agency.csv).',
		type: 'string',
		defaultStr: '–',
	},
	'variants': {
		description: 'Return stops/stations along the line?',
		type: 'boolean',
		default: true,
	},
	'mode': {
		description: 'Filter by mode of transport as in [*Friendly Public Transport Format* `1.2.1`](https://github.com/public-transport/friendly-public-transport-format/blob/1.2.1/spec/readme.md).',
		type: 'string',
		defaultStr: '–',
	},
	'product': {
		description: 'Filter by [product](https://github.com/public-transport/hafas-client/blob/5/p/vbb/products.js).',
		type: 'string',
		defaultStr: '–',
	},
}

export {
	linesRoute as route,
}
