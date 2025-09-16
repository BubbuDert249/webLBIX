// weblbix.js
(function(){
  let currentTransparency = 100;

  function loadFflate(callback){
    const tryLoad = (src, onFail) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = callback;
      s.onerror = onFail;
      document.head.appendChild(s);
    };
    tryLoad("https://cdn.jsdelivr.net/npm/fflate/umd/index.js", ()=>{
      tryLoad("https://unpkg.com/fflate/umd/index.js", ()=>{
        alert("Failed to load fflate from both JSDelivr and Unpkg");
      });
    });
  }

  function runLBScript(script, imgId, lbixName){
    const lines = script.split("\n");
    let lastInput = "";
    let pickedFile = "";

    for(let raw of lines){
      let line = raw.trim();
      if(!line) continue;
      line = line.split("//")[0].split("#")[0].trim();
      if(!line) continue;

      line = line
        .replace(/%txtboxinput%/g, lastInput)
        .replace(/%filepicker%/g, pickedFile)
        .replace(/%lbixname%/g, lbixName)
        .replace(/%math ([^%]+)%/g, (_, expr)=>{ try{return eval(expr);}catch{return "NaN";} });

      line = line.replace(/%[^%]*%/g,"");

      let matched = false;

      if(line.startsWith("showmsgbox")){
        const m = line.match(/"[^"]*",\s*"([^"]*)"/);
        if(m) alert(m[1]);
        matched = true;
      } else if(line.startsWith("showtxtbox")){
        const m = line.match(/"[^"]*",\s*"([^"]*)"/);
        if(m) lastInput = prompt(m[1],"") || "";
        matched = true;
      } else if(line.startsWith("showfilepicker")){
        const input = document.createElement("input");
        input.type = "file";
        input.onchange = e=>{ pickedFile = e.target.files[0]?.name || ""; };
        input.click();
        matched = true;
      } else if(line.startsWith("transparency")){
        const img = document.getElementById(imgId);
        if(img){
          if(line.includes("sub")) currentTransparency = Math.max(1,currentTransparency-parseInt(line.split("sub")[1]));
          else if(line.includes("add")) currentTransparency = Math.min(100,currentTransparency+parseInt(line.split("add")[1]));
          else{
            const val = parseInt(line.replace("transparency","").trim());
            if(!isNaN(val)) currentTransparency = Math.min(100,Math.max(1,val));
          }
          img.style.opacity = currentTransparency/100;
        }
        matched = true;
      } else if(line==="close"){
        window.close();
        matched = true;
      }

      if(!matched) console.error("Unknown LBScript command:", raw);
    }
  }

  function runLBIXBuffer(buf, imgId, name){
    const files = fflate.unzipSync(buf);
    let lbimg = files["image.lbimg"];
    const lbscript = files["main.lbscript"] ? new TextDecoder().decode(files["main.lbscript"]) : null;

    if(!lbimg) return console.error("LBIX missing image.lbimg");
    if(!(lbimg instanceof Uint8Array) && lbimg.buffer) lbimg = new Uint8Array(lbimg.buffer);

    // Convert LBIX5 -> PNG header
    const pngHeader = new Uint8Array([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
    const imgBytes = new Uint8Array(lbimg.length-5+8);
    imgBytes.set(pngHeader,0);
    imgBytes.set(lbimg.slice(5),8);

    // Use Blob + Object URL for fast display
    const blob = new Blob([imgBytes],{type:"image/png"});
    const url = URL.createObjectURL(blob);

    let img = document.getElementById(imgId);
    if(!img){
      img = document.createElement("img");
      img.id = imgId;
      document.body.appendChild(img);
    }
    img.src = url;
    img.style.opacity = currentTransparency/100;

    if(lbscript) runLBScript(lbscript,imgId,name);
  }

  function makeLBIX(scriptText,imgBuf,outputName){
    const arr = new Uint8Array(imgBuf);
    const magic = new TextEncoder().encode("LBIX5");
    arr.set(magic,0);
    for(let i=0;i<Math.min(arr.length,8);i++){
      if(arr[i]===37) arr[i]=32; // remove %
    }

    const files = {
      "image.lbimg": arr,
      "main.lbscript": new TextEncoder().encode(scriptText)
    };

    const out = fflate.zipSync(files);
    const blob = new Blob([out],{type:"application/octet-stream"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = outputName || "output.lbix";
    a.click();
  }

  const weblbix = {
    view: async function(pickerId,imgId){
      const input = document.getElementById(pickerId);
      if(!input || !input.files[0]) return console.error("No LBIX file chosen");
      const file = input.files[0];
      const buf = new Uint8Array(await file.arrayBuffer());
      runLBIXBuffer(buf,imgId,file.name);
    },
    build: async function(scriptText,pickerId,outputName="output.lbix"){
      const input = document.getElementById(pickerId);
      if(!input || !input.files[0]) return console.error("No PNG file chosen");
      const file = input.files[0];
      const buf = new Uint8Array(await file.arrayBuffer());
      makeLBIX(scriptText,buf,outputName);
    }
  };

  // Expose weblbix after fflate loads
  if(typeof fflate==="undefined"){
    loadFflate(()=>{ window.weblbix = weblbix; });
  }else{
    window.weblbix = weblbix;
  }
})();
