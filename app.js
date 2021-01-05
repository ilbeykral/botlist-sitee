const request = require('request');
const db = require('quick.db');
const fs = require('fs');

const url = require("url");
const path = require("path");

const Discord = require("discord.js");

var express = require('express');
var app = express();
const moment = require("moment");
require("moment-duration-format");

const passport = require("passport");
const session = require("express-session");
const LevelStore = require("level-session-store")(session);
const Strategy = require("passport-discord").Strategy;

const helmet = require("helmet");

const md = require("marked");

module.exports = (client) => {

const templateDir = path.resolve(`${process.cwd()}${path.sep}html`);

app.use("/css", express.static(path.resolve(`${templateDir}${path.sep}css`)));

passport.serializeUser((user, done) => {
done(null, user);
});
passport.deserializeUser((obj, done) => {
done(null, obj);
});

passport.use(new Strategy({
clientID: client.user.id,
clientSecret: client.ayarlar.oauthSecret,
callbackURL: client.ayarlar.callbackURL,
scope: ["identify"]
},
(accessToken, refreshToken, profile, done) => {
process.nextTick(() => done(null, profile));
}));

app.use(session({
secret: '123',
resave: false,
saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(helmet());

app.locals.domain = process.env.PROJECT_DOMAIN;

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

var bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ 
extended: true
})); 

function checkAuth(req, res, next) {
if (req.isAuthenticated()) return next();
req.session.backURL = req.url;
res.redirect("/giris");
}

const renderTemplate = (res, req, template, data = {}) => {
const baseData = {
bot: client,
path: req.path,
user: req.isAuthenticated() ? req.user : null
};
res.render(path.resolve(`${templateDir}${path.sep}${template}`), Object.assign(baseData, data));
};

app.get("/giris", (req, res, next) => {
if (req.session.backURL) {
req.session.backURL = req.session.backURL;
} else if (req.headers.referer) {
const parsed = url.parse(req.headers.referer);
if (parsed.hostname === app.locals.domain) {
req.session.backURL = parsed.path;
}
} else {
req.session.backURL = "/";
}
next();
},
passport.authenticate("discord"));

app.get("/baglanti-hatası", (req, res) => {
renderTemplate(res, req, "autherror.ejs");
});

app.get("/callback", passport.authenticate("discord", { failureRedirect: "/autherror" }), async (req, res) => {
if (req.session.backURL) {
const url = req.session.backURL;
req.session.backURL = null;
res.redirect(url);
} else {
res.redirect("/");
}
});

app.get("/cikis", function(req, res) {
req.session.destroy(() => {
req.logout();
res.redirect("/");
});
});

app.get("/", (req, res) => {
renderTemplate(res, req, "index.ejs");
});
  
  app.get("/alim", (req, res) => { renderTemplate (res, req, "alim.ejs") });

app.get("/sertifika", (req, res) => {

renderTemplate (res, req, "sertifika.ejs");
});

app.get("/hakkimizda", (req, res) => {
  
renderTemplate(res, req, "hakkımızda.ejs");
});

app.get("/botlar", (req, res) => {
 
renderTemplate(res, req, "botlar.ejs")
});

app.get("/botyonetim/hata", (req, res) => {
  
renderTemplate(res, req, "hataa.ejs")
});

app.get("/botekle/hata", (req, res) => {
 
renderTemplate(res, req, "hataaa.ejs")
});

app.get("/botekle", checkAuth, (req, res) => {
 
renderTemplate(res, req, "botekle.ejs")
});

app.post("/botekle", checkAuth, (req, res) => {

let ayar = req.body

if (ayar === {} || !ayar['botid'] || !ayar['botprefix'] || !ayar['kutuphane'] || !ayar['kisa-aciklama'] || !ayar['uzun-aciklama'] || !ayar['etikett']) return res.redirect('/botyonetim/hata')

let ID = ayar['botid']

if (db.has('botlar')) {
    if (Object.keys(db.fetch('botlar')).includes(ID) === true) return res.redirect('/botekle/hata')
}
  
  var tag = ''
  if (Array.isArray(ayar['etikett']) === true) {
    var tag = ayar['etikett']
  } else {
    var tag = new Array(ayar['etikett'])
  }

request({
url: `https://discordapp.com/api/v7/users/${ID}`,
headers: {
"Authorization": `Bot ${client.ayarlar.token}`
},
}, function(error, response, body) {
if (error) return console.log(error)
else if (!error) {
var sistem = JSON.parse(body)

db.set(`botlar.${ID}.id`, sistem.id||"201016292885397504")
db.set(`botlar.${ID}.isim`, sistem.username+"#"+sistem.discriminator)

db.set(`botlar.${ID}.avatar`, `https://cdn.discordapp.com/avatars/${sistem.id}/${sistem.avatar}.png`)

request({
url: `https://discordapp.com/api/v7/users/${req.user.id}`,
headers: {
"Authorization": `Bot ${client.ayarlar.token}`
},
}, function(error, response, body) {
if (error) return console.log(error)
else if (!error) {
var sahip = JSON.parse(body)

db.set(`botlar.${ID}.prefix`, ayar['botprefix'])
db.set(`botlar.${ID}.kutuphane`, ayar['kutuphane'])
db.set(`botlar.${ID}.sahip`, sahip.username+"#"+sahip.discriminator)
db.set(`botlar.${ID}.sahipid`, sahip.id)
db.set(`botlar.${ID}.kisaaciklama`, ayar['kisa-aciklama'])
db.set(`botlar.${ID}.uzunaciklama`, ayar['uzun-aciklama'])
db.set(`botlar.${ID}.etiket`, tag)
if (ayar['botsite']) {
db.set(`botlar.${ID}.site`, ayar['botsite'])
}
if (ayar['github']) {
db.set(`botlar.${ID}.github`, ayar['github'])
}
if (ayar['botdestek']) {
db.set(`botlar.${ID}.destek`, ayar['botdestek'])
}

db.set(`kbotlar.${req.user.id}.${ID}`, db.fetch(`botlar.${ID}`))

res.redirect("/kullanici/"+req.params.userID+"/panel");
client.channels.get(client.ayarlar.kayıt).send(`\`${sistem.username}#${sistem.discriminator}\` Adlı Bot Eklendi! | [\`${req.user.username}#${req.user.discriminator}\`]`)

if (client.users.has(req.user.id) === true) {
  client.users.get(req.user.id).send(`🎉 \`${sistem.username}#${sistem.discriminator}\` Adlı Botunuz Sisteme Eklendi. | Onaylanmasını Bekleyiniz!`)
}

}})
}})

});

app.get("/kullanicilar", (req, res) => {
  renderTemplate(res, req, "kullanicilar.ejs")
});

app.get("/kullanici/:userID", (req, res) => {

  request({
    url: `https://discordapp.com/api/v7/users/${req.params.userID}`,
    headers: {
      "Authorization": `Bot ${client.ayarlar.token}`
    },
  }, function(error, response, body) {
    if (error) return console.log(error)
    else if (!error) {
      var kisi = JSON.parse(body)

      renderTemplate(res, req, "kullanici.ejs", {kisi})
    };
  });

});

app.get("/kullanici/:userID/profil", (req, res) => {

  request({
    url: `https://discordapp.com/api/v7/users/${req.params.userID}`,
    headers: {
      "Authorization": `Bot ${client.ayarlar.token}`
    },
  }, function(error, response, body) {
    if (error) return console.log(error)
    else if (!error) {
      var kisi = JSON.parse(body)

      renderTemplate(res, req, "profil.ejs", {kisi})
    };
  });

});

app.get("/kullanici/:userID/profil/ayarla", checkAuth, (req, res) => {

  renderTemplate(res, req, "p-ayarla.ejs")

});

app.post("/kullanici/:userID/profil/ayarla", checkAuth, (req, res) => {

  if (req.params.userID !== req.user.id) return res.redirect('/');

  var profil = JSON.parse(fs.readFileSync('./profil.json', 'utf8'));

  var libs = ''
  if (Array.isArray(req.body['libs']) === true) {
    var libs = req.body['libs']
  } else {
    var libs = new Array(req.body['libs'])
  }

  request({
    url: `https://discordapp.com/api/v7/users/${req.params.userID}`,
    headers: {
      "Authorization": `Bot ${client.ayarlar.token}`
    },
  }, function(error, response, body) {
    if (error) return console.log(error)
    else if (!error) {
      var kisi = JSON.parse(body)

  var veri = JSON.parse(`{
  "tag": "${kisi.username}#${kisi.discriminator}",
  "isim": "${req.body['isim']}",
  "yas": "${req.body['yas']}",
  "biyo": "${req.body['biyo']}",
  "favlib": "${req.body['favlib']}",
  "libs": "${libs}",
  "avatar": "https://cdn.discordapp.com/avatars/${kisi.id}/${kisi.avatar}.png"
  }`)

  profil[req.user.id] = veri;

  var obj = JSON.stringify(profil)

  fs.writeFile('./profil.json', obj)

  res.redirect('/kullanici/'+req.user.id)

    }
  })

});

app.get("/kullanici/:userID/panel", checkAuth, (req, res) => {

renderTemplate(res, req, "panel.ejs")

});

app.get("/kullanici/:userID/panel/:botID/duzenle", checkAuth, (req, res) => {

var id = req.params.botID


renderTemplate(res, req, "duzenle.ejs", {id})

});


app.post("/kullanici/:userID/panel/:botID/duzenle", checkAuth, (req, res) => {

let ayar = req.body
let ID = req.params.botID
let s = req.user.id

var tag = ''
  if (Array.isArray(ayar['etikett']) === true) {
    var tag = ayar['etikett']
  } else {
    var tag = new Array(ayar['etikett'])
  }

request({
url: `https://discordapp.com/api/v7/users/${ID}`,
headers: {
"Authorization": `Bot ${client.ayarlar.token}`
},
}, function(error, response, body) {
if (error) return console.log(error)
else if (!error) {
var sistem = JSON.parse(body)

db.set(`botlar.${ID}.isim`, sistem.username+"#"+sistem.discriminator)

db.set(`botlar.${ID}.avatar`, `https://cdn.discordapp.com/avatars/${sistem.id}/${sistem.avatar}.png`)

request({
url: `https://discordapp.com/api/v7/users/${req.user.id}`,
headers: {
"Authorization": `Bot ${client.ayarlar.token}`
},
}, function(error, response, body) {
if (error) return console.log(error)
else if (!error) {
var sahip = JSON.parse(body)
db.set(`botlar.${ID}.prefix`, ayar['botprefix'])
db.set(`botlar.${ID}.kutuphane`, ayar['kutuphane'])
db.set(`botlar.${ID}.sahip`, sahip.username+"#"+sahip.discriminator)
db.set(`botlar.${ID}.sahipid`, sahip.id)
db.set(`botlar.${ID}.kisaaciklama`, ayar['kisa-aciklama'])
db.set(`botlar.${ID}.uzunaciklama`, ayar['uzun-aciklama'])
db.set(`botlar.${ID}.etiket`, tag)
if (ayar['botsite']) {
db.set(`botlar.${ID}.site`, ayar['botsite'])
}
if (ayar['github']) {
db.set(`botlar.${ID}.github`, ayar['github'])
}
if (ayar['botdestek']) {
db.set(`botlar.${ID}.destek`, ayar['botdestek'])
}

res.redirect("/kullanici/"+req.params.userID+"/panel");
}

})
}})

});

app.get("/bot/:botID/rapor", checkAuth, (req, res) => {

renderTemplate (res, req, "rapor.ejs");
});

app.post("/bot/:botID/rapor", checkAuth, (req, res) => {

let ayar = req.body

if(ayar['mesaj-1']) {
db.push(`botlar.${req.params.botID}.raporlar`, JSON.parse(`{ "rapor":"${ayar['mesaj-1']}" }`))

client.channels.get("739948026403225660").send(`\`${db.fetch(`botlar.${req.params.botID}.isim`)}\` Adlı Bot Raporlandı! | [\`${req.user.username}#${req.user.discriminator}\`] Sebep: \`${ayar['mesaj-1']}\``)

}
if(ayar['mesaj-2']) {
db.push(`botlar.${req.params.botID}.raporlar`, JSON.parse(`{ "rapor":"${ayar['mesaj-2']}" }`))
client.channels.get("739948026403225660").send(`\`${db.fetch(`botlar.${req.params.botID}.isim`)}\` Adlı Bot Raporlandı! | [\`${req.user.username}#${req.user.discriminator}\`] Sebep: \`${ayar['mesaj-2']}\``)
}

res.redirect('/bot/'+req.params.botID);
});

app.get("/kullanici/:userID/panel/:botID/sil", checkAuth, (req, res) => {
  var id = req.params.botID
  renderTemplate(res, req, "sil.ejs", {id}) 
});

app.post("/kullanici/:userID/panel/:botID/sil", checkAuth, (req, res) => {

let ID = req.params.botID

db.delete(`botlar.${ID}`) 
db.delete(`kbotlar.${req.user.id}.${ID}`)

res.redirect("/kullanici/"+req.params.userID+"/panel");
});

app.get("/bot/:botID", (req, res) => {
var id = req.params.botID

request({
url: `https://discordapp.com/api/v7/users/${id}`,
headers: {
"Authorization": `Bot ${client.ayarlar.token}`
},
}, function(error, response, body) {
if (error) return console.log(error)
else if (!error) {
var sistem = JSON.parse(body)

if (db.fetch(`${id}.avatar`) !== `https://cdn.discordapp.com/avatars/${sistem.id}/${sistem.avatar}.png`) {
db.set(`${id}.avatar`, `https://cdn.discordapp.com/avatars/${sistem.id}/${sistem.avatar}.png`)
}

}
})

renderTemplate(res, req, 'bot.ejs', {id})

});

app.get("/bot/:botID/hata", (req, res) => {
renderTemplate(res, req, "hata.ejs")
});

app.get("/oyver/:botID", (req, res) => {
var id = req.params.botID

request({
url: `https://discordapp.com/api/v7/users/${id}`,
headers: {
"Authorization": `Bot ${client.ayarlar.token}`
},
}, function(error, response, body) {
if (error) return console.log(error)
else if (!error) {
var sistem = JSON.parse(body)

if (db.fetch(`${id}.avatar`) !== `https://cdn.discordapp.com/avatars/${sistem.id}/${sistem.avatar}.png`) {
db.set(`${id}.avatar`, `https://cdn.discordapp.com/avatars/${sistem.id}/${sistem.avatar}.png`)
}

}
})

renderTemplate(res, req, 'vote.ejs', {id})

});
  
app.get("/bot/:botID/oyver", checkAuth, async (req, res) => {
const ms = require("ms")
var id = req.params.botID
let user = req.user.id
  
 if (db.fetch(`botlar.${id}.durum`) === 'Beklemede' || db.has(`botlar.${id}.durum`) === false) { 
                 res.status(404).json({ error: 'Bot Not approved.' });
    }

   let cooldown = 8.64e+7, // 24 Saat
        amount = Math.floor(Math.random() * 1000) + 4000;      

    let lastDaily = await db.fetch(`oylar.${id}.${user}`);
    if (lastDaily !== null && cooldown - (Date.now() - lastDaily) > 0) {
        let timeObj = ms(cooldown - (Date.now() - lastDaily));
  
      res.redirect('/bot/'+req.params.botID+'/hata')
    return
      
    } else {
     
        db.add(`botlar.${id}.oy`, 1)
  db.set(`oylar.${id}.${user}`,  Date.now())
    client.channels.get(client.ayarlar.oylog).send(`<@${id}> Oy Verildi | [<@${user}>]`);  
      
    }
  
  
res.redirect('/bot/'+req.params.botID)

});
  
  
app.get("/yetkili/hata", (req, res) => {renderTemplate(res, req, "hate.ejs")})

app.get("/yetkili", checkAuth, (req, res) => {
  if(!client.yetkililer.includes(req.user.id) ) return res.redirect('/yetkili/hata')
renderTemplate(res, req, "y-panel.ejs") 
});

app.get("/botyonetici/onayla/:botID", checkAuth, (req, res) => {
  if(!client.yetkililer.includes(req.user.id) ) return res.redirect('/yetkili/hata')
let id = req.params.botID

db.set(`botlar.${id}.durum`, 'Onaylı')

res.redirect("/yetkili")
client.channels.get(client.ayarlar.kayıt).send(`\`${db.fetch(`botlar.${id}.isim`)}\` adlı bot onaylandı! - [\`${db.fetch(`botlar.${id}.sahip`)}\`]`)

if (client.users.has(db.fetch(`botlar.${id}.sahipid`)) === true) {
client.users.get(db.fetch(`botlar.${id}.sahipid`)).send(`\`${db.fetch(`botlar.${id}.isim`)}\` Adlı Botunuz Onaylandı! \n ${client.ayarlar.site}/bot/${db.fetch(`botlar.${id}.id`)}`)
}
  
  let guild = client.guilds.get(client.ayarlar.sunucu) 
let role = guild.roles.get(client.roles.Geliştirici)
let member = guild.member(`${db.fetch(`botlar.${id}.sahipid`)}`)
member.addRole(role)

});
  

app.get("/botyonetici/bekleme/:botID", checkAuth, (req, res) => {
  if(!client.yetkililer.includes(req.user.id) ) return res.redirect('/yetkili/hata')
let id = req.params.botID

db.set(`botlar.${id}.durum`, 'Beklemede')

res.redirect("/yetkili")
client.channels.get(client.ayarlar.kayıt).send(`\`${db.fetch(`botlar.${id}.isim`)}\` Adlı Bot Bekleme Moduna Alındı! - [\`${db.fetch(`botlar.${id}.sahip`)}\`]`)

  let embeds = new Discord.RichEmbed() 
  .setColor("RANDOM") 
  .setDescription(`\`${db.fetch(`botlar.{id}.isim`)}\` Adlı Botunuz Beklemeye **alındı!**`)
if (client.users.has(db.fetch(`botlar.${id}.sahipid`)) === true) {
client.users.get(db.fetch(`botlar.${id}.sahipid`)).send(`\`${db.fetch(`botlar.${id}.isim`)}\` Adlı Botunuz Beklemeye **Alındı!**`)
}

});

app.get("/botyonetici/sal/:botID", checkAuth, (req, res) => {
  if(!client.yetkililer.includes(req.user.id) ) return res.redirect('/yetkili/hata')
let id = req.params.botID

db.set(`botlar.${id}.sertifika`, 'Bulunuyor')

res.redirect("/yetkili")
//.addField('Sayfası',`[Tıkla](https://firelist.glitch.me/bot/${db.fetch(`botlar.${id}.id`)})`)
client.channels.get(client.ayarlar.kayıt).send(`\`${db.fetch(`botlar.${id}.isim`)}\` Adlı Bot Sertifika Verildi! - [\`${db.fetch(`botlar.${id}.sahip`)}\`]`)
/*
client.channels.get(client.ayarlar.kayıt).send(`\`${req.user.username}#${req.user.discriminator}\` adlı yetkili tarafından \`${db.fetch(`botlar.${id}.sahip`)}\` adlı kullanıcının \`${db.fetch(`botlar.${id}.id`)}\` ID'ine sahip \`${db.fetch(`botlar.${id}.isim`)}\` adlı botu bekleme moduna alındı!`)
*/
});
app.get("/botyonetici/ssil/:botID", checkAuth, (req, res) => {
  if(!client.yetkililer.includes(req.user.id) ) return res.redirect('/yetkili/hata')
let id = req.params.botID

res.redirect("/yetkili")
  
db.delete(`botlar.${id}.sertifika`)

client.channels.get(client.ayarlar.kayıt).send(`\`${db.fetch(`botlar.${id}.isim`)}\` Adlı bot Sertifika Geri Alındı! - [\`${db.fetch(`botlar.${id}.sahip`)}\`]`)
/*
client.channels.get(client.ayarlar.kayıt).send(`\`${req.user.username}#${req.user.discriminator}\` adlı yetkili tarafından \`${db.fetch(`botlar.${id}.sahip`)}\` adlı kullanıcının \`${db.fetch(`botlar.${id}.id`)}\` ID'ine sahip \`${db.fetch(`botlar.${id}.isim`)}\` adlı botu bekleme moduna alındı!`)
*/
});
app.get("/botyonetici/reddet/:botID", checkAuth, (req, res) => {
  if(!client.yetkililer.includes(req.user.id) ) return res.redirect('/yetkili/hata')
  renderTemplate(res, req, "reddet.ejs")
});

app.post("/botyonetici/reddet/:botID", checkAuth, (req, res) => {
  if(!client.yetkililer.includes(req.user.id) ) return res.redirect('/yetkili/hata')
  let id = req.params.botID
  
  db.set(`botlar.${id}.durum`, 'Reddedilmiş')
  
  res.redirect("/yetkili")
  client.channels.get(client.ayarlar.kayıt).send(`\`${db.fetch(`botlar.${id}.isim`)}\` Adlı Bot Reddedildi! - [\`${db.fetch(`botlar.${id}.sahip`)}\`] Sebep: \`${req.body['red-sebep']}\``)
  
  if (client.users.has(db.fetch(`botlar.${id}.sahipid`)) === true) {
  client.users.get(db.fetch(`botlar.${id}.sahipid`)).send(`\`${db.fetch(`botlar.${id}.isim`)}\` Adlı Botunuz \`${req.body['red-sebep']}\` Sebebi İle **Reddedildi!**`)
  }

  });

//API
  
app.get("/api", (req, res) => {
  renderTemplate(res, req, "api.ejs")
});

app.get("/api/botlar", (req, res) => {
  res.json({
    hata: 'Bir bot ID yazınız!'
  });
});

app.get("/api/botlar/:botID/oylar", (req, res) => {
  res.json({
    hata: 'Bir kullanıcı ID yazınız!'
  });
});

app.get("/api/botlar/:botID", (req, res) => {
   var id = req.params.botID

   if (db.has('botlar')) {
      if (Object.keys(db.fetch('botlar')).includes(id) === false) {
     res.json({
       hata: `Yazdığınız ID'e sahip bir bot bulunmuyor!`
     });
   }
  }

    res.json({
       isim: db.fetch(`botlar.${id}.isim`),
       id: id,
avatar: db.fetch(`botlar.${id}.avatar`),
prefix: db.fetch(`botlar.${id}.prefix`),
kütüphane: db.fetch(`botlar.${id}.kutuphane`),
sahip: db.fetch(`botlar.${id}.sahip`),
sahipid: db.fetch(`botlar.${id}.sahipid`),
kisa_aciklama: db.fetch(`botlar.${id}.kisaaciklama`),
uzun_aciklama: db.fetch(`botlar.${id}.uzunaciklama`),
etiketler: db.fetch(`botlar.${id}.etiket`),
destek_sunucusu: db.fetch(`botlar.${id}.destek`) || 'Belirtilmemiş',
web_sitesi: db.fetch(`botlar.${id}.site`) || 'Belirtilmemiş',
github: db.fetch(`botlar.${id}.github`) || 'Belirtilmemiş',
durum: db.has(`botlar.${id}.durum`) ? db.fetch(`botlar.${id}.durum`) : 'Beklemede',
oy_sayisi: db.fetch(`botlar.${id}.oy`) || 0,
sertifika: db.fetch(`botlar.${id}.sertifika`) || 'Bulunmuyor'
    });
});

  app.get("/api/tumbotlar", (req, res) => {
    res.json(Object.keys(db.fetch('botlar')));
  });
  
app.get("/api/botlar/:botID/oylar/:kullaniciID", (req, res) => {
  var id = req.params.botID
  var userr = req.params.kullaniciID

  if (db.has('botlar')) {
      if (Object.keys(db.fetch('botlar')).includes(id) === false) {
     res.json({
       hata: `Yazdığınız ID'e sahip bir bot bulunmuyor!`
     });
   }
  }
 
   res.json({
     oy_durum: db.has(`oylar.${id}.${userr}`) ? `Bugün oy vermiş.` : null,
     oy_sayisi: db.fetch(`botlar.${id}.oy`) || 0
   });

});

app.listen(3000);

//Blog

app.get("/blog", (req, res) => {
  res.redirect('/');
});
  
};
