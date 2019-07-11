# OPL 3 Emulator
This is a Typescript-Port (*not a cross compile*) of the "dbopl.cpp"/"adlib.h",... Adlib OPL3 Emulator original written by "dosbox team"

## Why
There are some cross compiled versions of the DOSBox OPL emulator using Emscripten Compiler Frontend (emcc) and WebAssembly. But, these cross compiled versions are big, slow and not easy to integrate into a TypScript application.
So I decided to create a port of the C++ DOSBox OPL emulator to use it in my [Lemmings.ts](https://github.com/tomsoftware/Lemmings.ts) project. Cause of this some changes need to be made.
* replacing C++ templates by methods
* handling crazy address jumping
* fix type mismatch between c++ and Typescript


## License of the original code written by "dosbox team"
GNU General Public License
OPL emulator: Copyright 2002-2015 The DOSBox Team

[DosBox](https://www.dosbox.com/crew.php)

## Test.js is used from
[opljs]https://github.com/Malvineous/opljs)


## Run
open `test.html`

## Use
```Typescript

	/// create emulator
    let opl = new DBOPL.OPL(audioCtx.sampleRate, 2);
	
	/// write register
	opl.write(reg, val);
	
	/// generate samples / wave
	let samples = opl.generate(sampelCount);

```

## Deploy
you only need the `alib.js` file


## License of this port
Cause the original is "GNU General Public License" this port is also "GNU General Public License"
