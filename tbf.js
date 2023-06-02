const morseDict = {
	'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..',
	'e': '.', 'f': '..-.', 'g': '--.', 'h': '....',
	'i': '..', 'j': '.---', 'k': '-.-', 'l': '.-..',
	'm': '--', 'n': '-.', 'o': '---', 'p': '.--.',
	'q': '--.-', 'r': '.-.', 's': '...', 't': '-',
	'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-',
	'y': '-.--', 'z': '--..', ' ': ' ', '1': '.----',
	'2': '..---', '3': '...--', '4': '....-', '5': '.....',
	'6': '-....', '7': '--...', '8': '---..', '9': '----.',
	'0': '-----', '.': '.-.-.-', ',': '--..--', '?': '..--..',
	"'": '.----.', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
	'&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
	'+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.',
	'$': '...-..-', '!': '-.-.--', '@': '.--.-.', " ": '..--',
	'\n': '.--.--', '<': '...-.-', '.': '...-..',
	'□': '.--..-.-'
}; 

const fs = require("fs");
const fetch = require("node-fetch");
const { promisify } = require("util");
const writeFileAsync = promisify(fs.writeFile);
const fileExistAsync = promisify(fs.exists);
const readFileAsync = promisify(fs.readFile);
const unicode = require("./unicode.js");
const info = require('./info.js');
const seedrandom = require("seedrandom");

function genDict(chars, seed) {
	//chars in format: "<char>": ["<code>","<name>"]
	let dict = {};
	let keys = [];
	function makeCode(seed, iteration, salt, maxLength, raw) {
		if (maxLength > 30) {
			maxLength = maxLength % 20;
		}
		if (maxLength < 2) {
			maxLength = 8;
		}
		maxLength -= maxLength % 4
		maxLength += 4;
		//console.log(maxLength)
		let code = rand(seed, iteration, salt, maxLength);

		if (keys.includes(code)) {
			let oldcode = code;

			code = makeCode(
				seed + 1,
				iteration,
				salt,
				Math.floor(seedrandom(maxLength).double() * 20),
				true
			);
			console.log("duplicate code", oldcode, " made new code:", code);
		}
		keys.push(code);
		if (!raw) code = code.replaceAll("0", ".").replaceAll("1", "-");

		return code;
	}
	Object.keys(chars).forEach((char, i) => {
		let code = parseInt(chars[char][0]);
		let newCode = makeCode(
			seed,
			i + 1,
			code,
			Math.floor(seedrandom(i).double() * 14)
		);
		dict[char] = newCode;
	});
	return dict;
}
async function getDict(chars, seed, dictname = "autogen") {
	const charLength = Object.keys(chars).length;
	const filename = `./dictionaries/dict_${dictname}_${seed}_${charLength}.mdict`;
	const dictExists = await fileExistAsync(filename);
	if (dictExists) {
		let dict = await readFileAsync(filename);
		return JSON.parse(dict);
	} else {
		let dict = genDict(chars, seed);
		await writeFileAsync(filename, JSON.stringify(dict));
		return dict;
	}
}


function rand(seed, iteration, salt = 0, maxSize = 24) {
	if (seed === null || seed === 0) {
		return "0".repeat(maxSize - 1) + "0";
	}

	const a = 1664525 + (seed*2);
	const c = 1013904223 + (salt*100);
	//c += Math.floor(c*Math.sin(salt));
	const m = Math.pow(2, 32);

	let x = seed;
	for (let i = 0; i < iteration; i++) {
		x = (((a * x + c) % m) * c) / a;
	}
	x = Math.ceil(x);

	const binary = (x >>> 0).toString(2);
	const padded = binary.padStart(32, "0");
	const truncated = padded.substr(-maxSize);

	return truncated;
}
function chunkSubstr(str, size) {
	let pad = 0;
	if (str % size != 0) {
		pad = str % size;
	}
	str +='='.repeat(pad);
	const numChunks = Math.ceil(str.length / size)
	const chunks = new Array(numChunks)

	for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
		chunks[i] = str.substr(o, size)
	}

	return chunks
}
function xor(str1, str2, pad = 8) {
	if (!str2.includes("1")) {
		return str1;
	}
	const maxLength = str1.length + pad;
	const xorArray = [];

	for (let i = 0; i < maxLength; i++) {
		const bit1 = parseInt(str1.charAt(i), 2);
		const bit2 = parseInt(str2.charAt(i), 2);
		const xorBit = bit1 ^ bit2;
		xorArray.push(xorBit);
	}

	return xorArray.slice(0, maxLength).join("");
}
function xorBinary(binary, seed, iteration) {
	let length = binary.length;
	if (binary.length > 8) {
		length = 8;
	}
	
	let result = "";
	binary = chunkSubstr(binary,8);
	binary.forEach((byte, i) => {
		let randBinary = rand(seed, iteration, i, 8);
		//console.log(i,randBinary,rand(seed,iteration,0,8));
		for (let i = 0; i < byte.length; i++) {
			//console.log(byte[i],randBinary[i]);
			result += byte[i] ^ randBinary[i];
		}
	})
	
	
	
	return result;
}
function invertBits(binary) {
  return binary
    .split("")
    .map(bit => (bit === "0" ? "1" : "0"))
    .join("");
}
function invertChunks(bin) {
	
	let chunks = chunkSubstr(bin,4);
	let out = '';
	chunks.forEach(chunk => {
		out =  chunk.split("").reverse().join("") + out;
	});
	return out;
}
function obfuscate(bin, seed, iteration) {
	
	let out = bin;
	out = xorBinary(out,seed,1);
	out = out.split("").reverse().join("");
	out = invertBits(out);
	out = invertChunks(out);
	//console.log('obfuscating',{bin,out})
	return out;
}
function deobfuscate(bin, seed, iteration) {
	let out = bin;
	out = invertChunks(out);
	out = invertBits(out);
	out = out.split("").reverse().join("");
	out = xorBinary(out,seed,1);
	//console.log('deobfuscating',{bin,out})
	return out;
}
let str = '101011010010010111001011';
    str = '110011100010001011001011';
console.log(str.length)
console.log('===obfus===');
let obf = obfuscate(str,123,1);
console.log('===deobf===');
let dbf = deobfuscate(obf,123,1);
console.log(str == dbf, (JSON.stringify({str,obf,dbf},null,2)));
function findDupes(array) {
	const seen = {};
	const duplicates = [];

	array.forEach((value) => {
		if (seen[value]) {
			duplicates.push(value);
		} else {
			seen[value] = true;
		}
	});

	return duplicates;
}
function compileMorse(seed, morse, encode = true) {
	let compiledMorse = {};
	let comp = [];
	let mlist = Object.keys(morse);
	let vals = Object.values(morse);
	let nlist = [];
	mlist.forEach((ky, i) => {
		let key = vals[i];
		let morsekey = key;
		let rnum = rand(seed, i);
		
		morsekey = morsekey.replace(/\./g, "01").replace(/-/g, "11");
		let newKey = xor(morsekey, rnum);
		newKey = '1'+newKey+'1'
		newKey = newKey.replace(/1001/g, "1011");
		newKey = newKey.replace(/1001/g, "1011");
		newKey = newKey.replace(/1001/g, "1011");
		newKey = newKey.replace(/1001/g, "1011");
		newKey = newKey.replace(/1001/g, "1011");
		newKey = newKey.slice(1,-1);
		if (encode) {
			compiledMorse[newKey] = ky;
		} else {
			compiledMorse[ky] = newKey;
		}
		nlist.push(newKey);
		comp.push(newKey);
	});
	let dupes = findDupes(nlist);
	if (dupes.length > 0) {
		return compileMorse(seed + 1001, morse, encode);
	}

	return compiledMorse;
}

function compress (bin) {
	
}
function decompress (bin) {
	
}


function encode(text, seed, dictionary) {
	let dict = compileMorse(seed, dictionary, false);
	//text = text.toLowerCase();
	let newText = [];
	text.split("").forEach((letter, i) => {
		let newLet = dict[letter] || dict["□"];
		if (!dict[letter]) {
			console.log(`letter ${letter} does not exist in dictionary...`);
		}
		newText.push(newLet);
	});
	
	newText = newText.join("1001") + "";
	newText = obfuscate(newText, seed, 1);
	return newText;
}
function decode(text, seed, dictionary) {
	let dict = compileMorse(seed, dictionary, true);
	let newText = [];
	text = deobfuscate(text, seed, 1);
	newText = text.split("1001");
	let out = "";
	newText.forEach((letter, i) => {
		out += dict[letter];
	});
	return out;
}

async function getRandomChars(id) {
  let ranky = await fetch(
    "https://www.random.org/strings/?num=1&len=8&digits=on&unique=on&format=plain&rnd=id." +
      id
  );
  return await ranky.text();
}
async function makeFileName(name, cryptic = false) {
  let maxSize = 64;
  let seed = await fetch(
    "https://www.random.org/strings/?num=1&len=8&digits=on&unique=on&format=plain&rnd=new"
  );
  seed = await seed.text();
  //let seed = Math.floor(Math.random()*100000000)+Date.now();
  const binary = (seed >>> 0).toString(2);
  const padded = binary.padStart(32, "0");
  const truncated = padded.substr(-maxSize);
  nm = truncated;
  let bintxt = encode(name, 123, morseDict);
  bintxt = bintxt.match(/.{16}/g);
  bintxt.forEach((bin) => {
    nm = xor(nm, bin, 0);
  });
  nm = parseInt(nm, 2).toString(16);
	let fileName = info.version+ "."+nm+".tbf";
  console.log("is cryptic:", cryptic, !!cryptic);
  if (!!cryptic) {
    console.log("it's cryptic:", cryptic);
		fileName = `${name}.${fileName}`;
//    fileName = name +  "." + fileName;
  }
  return fileName;
}
function getSeedFromFile(filename) {
  let split = filename.split(".");
  if (split.length == 4) split.shift();
  if (split.length > 3) {
    return 0; //invalid name
  }
	let version = split[0];
  let seed = split[1];
  let type = split[2];
	if (version != info.version) {
		console.warn('version',version,' is not at the latest',info.version)
	}
  if (type != "tbf") {
    return 0; //invalid type
  }
  return parseInt(seed, 16);
}
function makeFile(data, filename, cryptic = false, dictionarySeed = 0) {
  return new Promise(async (resolve, reject) => {
    try {
      const dict = await getDict(unicode.chars, dictionarySeed);
      const generatedFileName = await makeFileName(filename, cryptic);
      const seed = getSeedFromFile(generatedFileName);

      const binaryData = encode(data, seed, dict);
      // Convert binary data to a buffer
      const buffer = Buffer.from(binaryData, "binary");

      // Write buffer to a file
      await writeFileAsync("./files/" + generatedFileName, buffer);

      // Send the file to the client
      resolve({ fileData: binaryData, fileName: generatedFileName });
    } catch (error) {
      reject(error);
    }
  });
}

let fn = "file.985f4889.tbf";
let fd = "1111011101011010000111111011111000111101110101101000";

async function getFileData(filename, fileDat, dictseed) {
  let dict = await getDict(unicode.chars, dictseed);
  let seed = getSeedFromFile(filename);
  let data = decode(fileDat, seed, dict);
  return data;
}

module.exports = {
  encode,
  decode,
  makeFile,
  getFileData,
  makeFileName,
  getSeedFromFile,
  genDict,
	getDict
};

function writeBinaryFile(filePath, binaryString) {
  const data = Buffer.from(binaryString, "binary");
  fs.writeFileSync(filePath, data, { encoding: "binary" });
  console.log("Binary data written to file successfully.");
}
function readBinaryFile(filePath) {
  const data = fs.readFileSync(filePath, { encoding: "binary" });
  const binaryString = data.toString("binary");
  console.log("Binary data read from file successfully.");
  return binaryString;
}
function readBinaryFile_old(filepath) {
  const buffer = fs.readFileSync(filepath);
  return buffer.toString("binary");
}
function writeBinaryFile_old(filepath, binaryString) {
  const buffer = Buffer.from(binaryString, "binary");
  fs.writeFileSync(filepath, buffer);
}
function readHex(file) {
  let fileContents = fs.readFileSync(__dirname + file, 'utf8');
  let decoded = Buffer.from(fileContents, "hex").toString("utf8");
  return decoded;
}
function writeHex(str, file) {
  let filePath = __dirname + file;
  let encoded = Buffer.from(str, "utf8").toString('hex')
  fs.writeFileSync(filePath, encoded, 'utf8')
}
