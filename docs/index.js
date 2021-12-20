const matchEscSqlRx = /[\0\b\t\n\r\x1a"'\\]/g;
function escapeSql(sqlStr) {
    const match = matchEscSqlRx.exec(sqlStr);
    if (!match) {
        return sqlStr;
    }
    let chunkIndex = matchEscSqlRx.lastIndex = 0;
    let escapedSqlStr = '';
    let matchChar;
    let escape;
    while(matchChar = matchEscSqlRx.exec(sqlStr)){
        switch(matchChar[0]){
            case '\0':
                escape = '\\0';
                break;
            case '\x08':
                escape = '\\b';
                break;
            case '\x09':
                escape = '\\t';
                break;
            case '\x1a':
                escape = '\\z';
                break;
            case '\n':
                escape = '\\n';
                break;
            case '\r':
                escape = '\\r';
                break;
            case '\"':
            case '\'':
            case '\\':
            case '%':
                escape = '\\' + matchChar[0];
                break;
            default:
                continue;
        }
        escapedSqlStr += sqlStr.slice(chunkIndex, matchChar.index) + escape;
        chunkIndex = matchEscSqlRx.lastIndex;
    }
    if (chunkIndex < sqlStr.length) {
        return "'" + escapedSqlStr + sqlStr.slice(chunkIndex) + "'";
    }
    return "'" + escapedSqlStr + "'";
}
!function(e, t) {
    if ("object" == typeof exports && "object" == typeof module) module.exports = t();
    else if ("function" == typeof define && define.amd) define([], t);
    else {
        var n = t();
        for(var r in n)("object" == typeof exports ? exports : e)[r] = n[r];
    }
}(this, function() {
    return (()=>{
        "use strict";
        var e1 = {
            870: (e1, t, n2)=>{
                n2.r(t), n2.d(t, {
                    createEndpoint: ()=>o1
                    ,
                    expose: ()=>l
                    ,
                    proxy: ()=>g
                    ,
                    proxyMarker: ()=>r
                    ,
                    releaseProxy: ()=>a1
                    ,
                    transfer: ()=>y
                    ,
                    transferHandlers: ()=>c
                    ,
                    windowEndpoint: ()=>v
                    ,
                    wrap: ()=>f
                });
                const r = Symbol("Comlink.proxy"), o1 = Symbol("Comlink.endpoint"), a1 = Symbol("Comlink.releaseProxy"), s1 = Symbol("Comlink.thrown"), i = (e)=>"object" == typeof e && null !== e || "function" == typeof e
                , c = new Map([
                    [
                        "proxy",
                        {
                            canHandle: (e)=>i(e) && e[r]
                            ,
                            serialize (e) {
                                const { port1: t , port2: n  } = new MessageChannel;
                                return l(e, t), [
                                    n,
                                    [
                                        n
                                    ]
                                ];
                            },
                            deserialize: (e)=>(e.start(), f(e))
                        }
                    ],
                    [
                        "throw",
                        {
                            canHandle: (e)=>i(e) && s1 in e
                            ,
                            serialize ({ value: e  }) {
                                let t;
                                return t = e instanceof Error ? {
                                    isError: !0,
                                    value: {
                                        message: e.message,
                                        name: e.name,
                                        stack: e.stack
                                    }
                                } : {
                                    isError: !1,
                                    value: e
                                }, [
                                    t,
                                    []
                                ];
                            },
                            deserialize (e) {
                                if (e.isError) throw Object.assign(new Error(e.value.message), e.value);
                                throw e.value;
                            }
                        }
                    ]
                ]);
                function l(e, t = self) {
                    t.addEventListener("message", function n(r) {
                        if (!r || !r.data) return;
                        const { id: o , type: a , path: i  } = Object.assign({
                            path: []
                        }, r.data), c = (r.data.argumentList || []).map(w);
                        let f;
                        try {
                            const t1 = i.slice(0, -1).reduce((e, t)=>e[t]
                            , e), n1 = i.reduce((e, t)=>e[t]
                            , e);
                            switch(a){
                                case 0:
                                    f = n1;
                                    break;
                                case 1:
                                    t1[i.slice(-1)[0]] = w(r.data.value), f = !0;
                                    break;
                                case 2:
                                    f = n1.apply(t1, c);
                                    break;
                                case 3:
                                    f = g(new n1(...c));
                                    break;
                                case 4:
                                    {
                                        const { port1: t , port2: n  } = new MessageChannel;
                                        l(e, n), f = y(t, [
                                            t
                                        ]);
                                    }
                                    break;
                                case 5:
                                    f = void 0;
                            }
                        } catch (e2) {
                            f = {
                                value: e2,
                                [s1]: 0
                            };
                        }
                        Promise.resolve(f).catch((e)=>({
                                value: e,
                                [s1]: 0
                            })
                        ).then((e)=>{
                            const [r, s] = b(e);
                            t.postMessage(Object.assign(Object.assign({
                            }, r), {
                                id: o
                            }), s), 5 === a && (t.removeEventListener("message", n), u(t));
                        });
                    }), t.start && t.start();
                }
                function u(e) {
                    (function(e) {
                        return "MessagePort" === e.constructor.name;
                    })(e) && e.close();
                }
                function f(e, t) {
                    return d(e, [], t);
                }
                function p(e) {
                    if (e) throw new Error("Proxy has been released and is not useable");
                }
                function d(e, t = [], n1 = function() {
                }) {
                    let r = !1;
                    const s2 = new Proxy(n1, {
                        get (n, o) {
                            if (p(r), o === a1) return ()=>E(e, {
                                    type: 5,
                                    path: t.map((e)=>e.toString()
                                    )
                                }).then(()=>{
                                    u(e), r = !0;
                                })
                            ;
                            if ("then" === o) {
                                if (0 === t.length) return {
                                    then: ()=>s2
                                };
                                const n = E(e, {
                                    type: 0,
                                    path: t.map((e)=>e.toString()
                                    )
                                }).then(w);
                                return n.then.bind(n);
                            }
                            return d(e, [
                                ...t,
                                o
                            ]);
                        },
                        set (n, o, a) {
                            p(r);
                            const [s, i] = b(a);
                            return E(e, {
                                type: 1,
                                path: [
                                    ...t,
                                    o
                                ].map((e)=>e.toString()
                                ),
                                value: s
                            }, i).then(w);
                        },
                        apply (n, a, s) {
                            p(r);
                            const i = t[t.length - 1];
                            if (i === o1) return E(e, {
                                type: 4
                            }).then(w);
                            if ("bind" === i) return d(e, t.slice(0, -1));
                            const [c, l] = m(s);
                            return E(e, {
                                type: 2,
                                path: t.map((e)=>e.toString()
                                ),
                                argumentList: c
                            }, l).then(w);
                        },
                        construct (n, o) {
                            p(r);
                            const [a, s] = m(o);
                            return E(e, {
                                type: 3,
                                path: t.map((e)=>e.toString()
                                ),
                                argumentList: a
                            }, s).then(w);
                        }
                    });
                    return s2;
                }
                function m(e) {
                    const t = e.map(b);
                    return [
                        t.map((e)=>e[0]
                        ),
                        (n = t.map((e)=>e[1]
                        ), Array.prototype.concat.apply([], n))
                    ];
                    var n;
                }
                const h = new WeakMap;
                function y(e, t) {
                    return h.set(e, t), e;
                }
                function g(e) {
                    return Object.assign(e, {
                        [r]: !0
                    });
                }
                function v(e, t = self, n = "*") {
                    return {
                        postMessage: (t, r)=>e.postMessage(t, n, r)
                        ,
                        addEventListener: t.addEventListener.bind(t),
                        removeEventListener: t.removeEventListener.bind(t)
                    };
                }
                function b(e) {
                    for (const [t, n] of c)if (n.canHandle(e)) {
                        const [r, o] = n.serialize(e);
                        return [
                            {
                                type: 3,
                                name: t,
                                value: r
                            },
                            o
                        ];
                    }
                    return [
                        {
                            type: 0,
                            value: e
                        },
                        h.get(e) || []
                    ];
                }
                function w(e) {
                    switch(e.type){
                        case 3:
                            return c.get(e.name).deserialize(e.value);
                        case 0:
                            return e.value;
                    }
                }
                function E(e, t, n) {
                    return new Promise((r)=>{
                        const o = new Array(4).fill(0).map(()=>Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)
                        ).join("-");
                        e.addEventListener("message", function t(n) {
                            n.data && n.data.id && n.data.id === o && (e.removeEventListener("message", t), r(n.data));
                        }), e.start && e.start(), e.postMessage(Object.assign({
                            id: o
                        }, t), n);
                    });
                }
            },
            162: function(e1, t2, n) {
                var r = this && this.__createBinding || (Object.create ? function(e, t, n, r) {
                    void 0 === r && (r = n), Object.defineProperty(e, r, {
                        enumerable: !0,
                        get: function() {
                            return t[n];
                        }
                    });
                } : function(e, t, n, r) {
                    void 0 === r && (r = n), e[r] = t[n];
                }), o = this && this.__setModuleDefault || (Object.create ? function(e, t) {
                    Object.defineProperty(e, "default", {
                        enumerable: !0,
                        value: t
                    });
                } : function(e, t) {
                    e.default = t;
                }), a = this && this.__importStar || function(e) {
                    if (e && e.__esModule) return e;
                    var t1 = {
                    };
                    if (null != e) for(var n1 in e)"default" !== n1 && Object.prototype.hasOwnProperty.call(e, n1) && r(t1, e, n1);
                    return o(t1, e), t1;
                };
                Object.defineProperty(t2, "__esModule", {
                    value: !0
                }), t2.createDbWorker = void 0;
                const s = a(n(870));
                async function i(e) {
                    if (e.data && "eval" === e.data.action) {
                        const t = new Int32Array(e.data.notify, 0, 2), n = new Uint8Array(e.data.notify, 8);
                        let r;
                        try {
                            r = {
                                ok: await u(e.data.request)
                            };
                        } catch (t1) {
                            console.error("worker request error", e.data.request, t1), r = {
                                err: String(t1)
                            };
                        }
                        const o = (new TextEncoder).encode(JSON.stringify(r));
                        n.set(o, 0), t[1] = o.length, Atomics.notify(t, 0);
                    }
                }
                function c(e) {
                    if ("BODY" === e.tagName) return "body";
                    const t = [];
                    for(; e.parentElement && "BODY" !== e.tagName;){
                        if (e.id) {
                            t.unshift("#" + e.id);
                            break;
                        }
                        {
                            let n = 1, r = e;
                            for(; r.previousElementSibling;)r = r.previousElementSibling, n++;
                            t.unshift(e.tagName.toLowerCase() + ":nth-child(" + n + ")");
                        }
                        e = e.parentElement;
                    }
                    return t.join(" > ");
                }
                function l(e) {
                    return Object.keys(e);
                }
                async function u(e) {
                    if (console.log("dom vtable request", e), "select" === e.type) return [
                        ...document.querySelectorAll(e.selector)
                    ].map((t)=>{
                        const n = {
                        };
                        for (const r of e.columns)"selector" === r ? n.selector = c(t) : "parent" === r ? t.parentElement && (n.parent = t.parentElement ? c(t.parentElement) : null) : "idx" === r || (n[r] = t[r]);
                        return n;
                    });
                    if ("insert" === e.type) {
                        if (!e.value.parent) throw Error('"parent" column must be set when inserting');
                        const t = document.querySelectorAll(e.value.parent);
                        if (0 === t.length) throw Error(`Parent element ${e.value.parent} could not be found`);
                        if (t.length > 1) throw Error(`Parent element ${e.value.parent} ambiguous (${t.length} results)`);
                        const n = t[0];
                        if (!e.value.tagName) throw Error("tagName must be set for inserting");
                        const r = document.createElement(e.value.tagName);
                        for (const t1 of l(e.value))if (null !== e.value[t1]) {
                            if ("tagName" === t1 || "parent" === t1) continue;
                            if ("idx" === t1 || "selector" === t1) throw Error(`${t1} can't be set`);
                            r[t1] = e.value[t1];
                        }
                        return n.appendChild(r), null;
                    }
                    if ("update" === e.type) {
                        const t = document.querySelector(e.value.selector);
                        if (!t) throw Error(`Element ${e.value.selector} not found!`);
                        const n = [];
                        for (const r of l(e.value)){
                            const o = e.value[r];
                            if ("parent" !== r) {
                                if ("idx" !== r && "selector" !== r && o !== t[r]) {
                                    if (console.log("SETTING ", r, t[r], "->", o), "tagName" === r) throw Error("can't change tagName");
                                    n.push(r);
                                }
                            } else if (o !== c(t.parentElement)) {
                                const e = document.querySelectorAll(o);
                                if (1 !== e.length) throw Error(`Invalid target parent: found ${e.length} matches`);
                                e[0].appendChild(t);
                            }
                        }
                        for (const r1 of n)t[r1] = e.value[r1];
                        return null;
                    }
                    throw Error(`unknown request ${e.type}`);
                }
                s.transferHandlers.set("WORKERSQLPROXIES", {
                    canHandle: (e)=>!1
                    ,
                    serialize (e) {
                        throw Error("no");
                    },
                    deserialize: (e)=>(e.start(), s.wrap(e))
                }), t2.createDbWorker = async function(e, t, n) {
                    const r = new Worker(t), o = s.wrap(r), a = await o.SplitFileHttpDatabase(n, e);
                    return r.addEventListener("message", i), {
                        db: a,
                        worker: o,
                        configs: e
                    };
                };
            },
            432: function(e, t, n) {
                var r = this && this.__createBinding || (Object.create ? function(e, t, n, r) {
                    void 0 === r && (r = n), Object.defineProperty(e, r, {
                        enumerable: !0,
                        get: function() {
                            return t[n];
                        }
                    });
                } : function(e, t, n, r) {
                    void 0 === r && (r = n), e[r] = t[n];
                }), o = this && this.__exportStar || function(e, t) {
                    for(var n1 in e)"default" === n1 || Object.prototype.hasOwnProperty.call(t, n1) || r(t, e, n1);
                };
                Object.defineProperty(t, "__esModule", {
                    value: !0
                }), o(n(162), t);
            }
        }, t = {
        };
        function n1(r) {
            var o = t[r];
            if (void 0 !== o) return o.exports;
            var a = t[r] = {
                exports: {
                }
            };
            return e1[r].call(a.exports, a, a.exports, n1), a.exports;
        }
        return n1.d = (e, t)=>{
            for(var r in t)n1.o(t, r) && !n1.o(e, r) && Object.defineProperty(e, r, {
                enumerable: !0,
                get: t[r]
            });
        }, n1.o = (e, t)=>Object.prototype.hasOwnProperty.call(e, t)
        , n1.r = (e)=>{
            "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
                value: "Module"
            }), Object.defineProperty(e, "__esModule", {
                value: !0
            });
        }, n1(432);
    })();
});
function loadConfig() {
    if (localStorage.getItem("darkMode") == 1) {
        document.documentElement.dataset.theme = "dark";
    }
}
function toggleDarkMode() {
    if (localStorage.getItem("darkMode") == 1) {
        localStorage.setItem("darkMode", 0);
        delete document.documentElement.dataset.theme;
    } else {
        localStorage.setItem("darkMode", 1);
        document.documentElement.dataset.theme = "dark";
    }
}
function search() {
    const word = document.getElementById("searchText").value;
    searchCollocations(word);
}
function iosCopyToClipboard(el) {
    el = typeof el === "string" ? document.querySelector(el) : el;
    if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
        const editable = el.contentEditable;
        const readOnly = el.readOnly;
        el.contentEditable = true;
        el.readOnly = true;
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        el.setSelectionRange(0, 999999);
        el.contentEditable = editable;
        el.readOnly = readOnly;
    } else {
        el.select();
    }
    document.execCommand("copy");
}
function copyToClipboard(text) {
    const input = document.createElement("textarea");
    document.body.appendChild(input);
    input.value = text;
    iosCopyToClipboard(input);
    document.body.removeChild(input);
    alert("クリップボードにコピーしました。");
}
async function searchCollocations(lemma) {
    const obj = document.getElementById("collocations");
    const row1 = await dbWorker.db.query(`SELECT wordid FROM words WHERE lemma="${escapeSql(lemma)}"`);
    if (row1[0]) {
        const wordid = row1[0].wordid;
        const row2 = await dbWorker.db.query(`SELECT word FROM collocations WHERE wordid=${wordid} ORDER BY count DESC`);
        while(obj.firstChild){
            obj.removeChild(obj.firstChild);
        }
        for (const item of row2){
            const word = item.word;
            const button = document.createElement("button");
            button.className = "btn btn-outline-secondary m-1";
            button.textContent = word;
            button.onclick = function() {
                copyToClipboard(button.textContent);
            };
            obj.appendChild(button);
        }
    } else {
        while(obj.firstChild){
            obj.removeChild(obj.firstChild);
        }
    }
}
async function loadDBWorker() {
    const config = {
        from: "jsonconfig",
        configUrl: "/db/config.json"
    };
    dbWorker = await createDbWorker([
        config
    ], "/sql.js-httpvfs/sqlite.worker.js", "/sql.js-httpvfs/sql-wasm.wasm");
    searchCollocations("走る");
}
let dbWorker;
loadConfig();
loadDBWorker();
document.addEventListener("keydown", function(event) {
    if (event.key == "Enter") {
        search();
    }
}, false);
document.getElementById("toggleDarkMode").onclick = toggleDarkMode;
document.getElementById("search").onclick = search;

