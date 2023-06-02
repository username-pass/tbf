const express = require("express");
const fs = require("fs");
const app = express();
const tbf = require("./tbf.js");
const unicode = require("./unicode.js");
const bodyParser = require("body-parser");
app.use(bodyParser.json({ limit: "50mb" }));
app.use((req, res, next) => {
  console.log("=====================", "=====================");
  console.log(
    "=========",
    new Date().toISOString(),
    "==",
    req.method,
    req.url,
    "========="
  );
  console.log(req.body);
  res.append("Access-Control-Allow-Origin", "*");
  res.append("Access-Control-Allow-Headers", "*");
  res.set("Access-Control-Expose-Headers", "*");
  next();
});

app.get("/", (req, res) => {
  res.header("Content-type", "text/html");
  res.send(fs.readFileSync("./public/client.html"));
});
app.get("/tbf", (req, res) => {
  res.header("Content-type", "text/html");
  res.send(fs.readFileSync("./tbf.js"));
});
app.get('/:filename', (req,res) => {
  res.header("Content-type", "text/html");
	res.send(fs.readFileSync("./public/"+req.params.filename));
})

app.get("/decode/:filename/:filedata", async (req, res) => {
  const { filename, filedata } = req.params;

  //const filedata = req.body.filedata;
  //console.log('filename',filename);
  //console.log('filedata',filedata);

  const result = await tbf.getFileData(filename, filedata);
  //console.log(filename,'\n',filedata,'\n',result);
  res.send(result);
});

app.get("/makefile/:filename/:filedata/:cryptic", async (req, res) => {
  try {
    const { filename, filedata, cryptic } = req.params;
    const result = await tbf.makeFile(filedata, filename, cryptic);

    // Set appropriate headers for file download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(result.fileData);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

app.get("/getdict/:seed", async (req, res) => {
  let dict = await tbf.getDict(unicode.chars, req.params.seed, "autogen");
  console.log("got dictionary:", {
    seed: req.params.seed,
    keys: Object.keys(dict).length,
  });
  //	console.log(dict)
  res.send(dict);
});


app.post("/makefile", async (req, res) => {
  console.log("makefile:", req.body);
  try {
    const { filename, filedata, cryptic, dict } = req.body;
    const result = await tbf.makeFile(filedata, filename, cryptic, dict);

    // Set appropriate headers for file download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");
    res.send({ data: result.fileData, name: result.fileName });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

app.post("/decode", async (req, res) => {
  const { filename, filedata, dict } = req.body;

  //const filedata = req.body.filedata;
  //console.log('filename',filename);
  //console.log('filedata',filedata);

  const result = await tbf.getFileData(filename, filedata, dict);
  console.log(
    filename,
    "\n",
    filedata.substring(0, 100) +
      "... " +
      (filedata.length - 100) +
      " more chars",
    "\n",
    result.substring(0, 100) + "... " + (result.length - 100) + " more chars"
  );
  res.send(result);
});

app.listen(3000, () => {
  console.log("server started");
});
