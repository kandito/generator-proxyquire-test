# generator-proxyquire-test [![npm version](https://badge.fury.io/js/generator-proxyquire-test.svg)](https://badge.fury.io/js/generator-proxyquire-test)
My simple tools to generate a boilerplate to write test cases in proxyquire. 
> Disclaimer: This tools has specific purpose to help my daily jobs, some mechanism maybe not applicable to you.

## Installation

First, install [Yeoman](http://yeoman.io) and generator-proxyquire-test using [npm](https://www.npmjs.com/) (we assume you have pre-installed [node.js](https://nodejs.org/)).

```bash
npm install -g yo
npm install -g generator-proxyquire-test
```

Then generate your new project:

```bash
yo proxyquire-test
```

## Example
```
     _-----_     ╭──────────────────────────╮
    |       |    │  Welcome to the supreme  │
    |--(o)--|    │ generator-proxyquire-tes │
   `---------´   │       t generator!       │
    ( _´U`_ )    ╰──────────────────────────╯
    /___A___\   /
     |  ~  |     
   __'.___.'__   
 ´   `  |° ´ Y ` 

? Path File? (relative from current directory) src/helpers/queue.js
? Source directory? (leave blank if current directory is base source directory) src
? Test directory? (leave blank is current directory is base source directory) tests
? Test suffix? spec
? Exclude dependencies (var names, separated by space)? _ Bluebird
   create tests/src/helpers/queue.spec.js
```

## License

ISC © [Kandito A. Wicaksono]()
