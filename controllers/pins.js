const jwt = require('jsonwebtoken');
const User = require("../models/user");
const Pin = require("../models/pin")
const fss = require('fast-string-search');
const cheerio = require('cheerio')

module.exports = app => {

    // used to search the url html when adding a new pin
    // app.get('/add-pins')
    function getData(title,data,target,stop){
        let shiftEnd
        if (title){
            shiftEnd = 0
        } else {
            shiftEnd = 1
        }
        const len_target = target.length
        var descriptionIndex = parseInt(fss.indexOf(data, target,0,1))+len_target;
        var shift = parseInt(fss.indexOf(data, stop ,descriptionIndex,1))-shiftEnd;
        return data.slice(descriptionIndex,shift)
    }

    // INDEX // display current pin the user left-off on...
    // primary pin-labelling functionality.
    // pins are pulled from database and referenced by index.
        app.get('/', (req, res) => {

            let id;
            let admin;
            let pinIndex;
            const admin_page = false;
            const currentUser = req.user;

            if (currentUser){
                id = currentUser._id
            }

            User.findOne({_id: id}).then( user => {

                if (user){
                    admin = user.admin
                    pinIndex = user.pinIndex
                }

                Pin.findOne({pinIndex : pinIndex}).then( pin => {
                    res.render('main', {currentUser, pin, admin, admin_page, pinIndex});
                });
            });
        });

        // INDEX -- See the next pin
        app.get('/next', (req, res) => {
            const admin_page = false;
            let id;
            let pinIndex;
            const currentUser = req.user;

            if (currentUser){
                id = currentUser._id
            }

            User.findOne({_id: id}).then( user => {

                if (user){
                    User.findOne( { admin : true } ).then( administrator => {
                    pinIndex = user.pinIndex
                    highestIndex = administrator.newPinIndex
                    if (pinIndex + 1 <= highestIndex){
                        pinIndex += 1
                        user.pinIndex = pinIndex
                    } else {
                        pinIndex = 1
                        user.pinIndex = pinIndex
                    }
                    user.save()
                    });
                }

                Pin.findOne( { pinIndex : user.pinIndex } ).then( pin => {
                    res.redirect('/');
                });

            });
        });

        // INDEX -- See the previous pin
        app.get('/previous', (req, res) => {
            const admin_page = false;
            let id;
            let pinIndex;
            const currentUser = req.user;

            if (currentUser){
                id = currentUser._id
            }

            User.findOne({_id: id}).then( user => {

                if (user){
                    User.findOne( { admin : true } ).then( administrator => {
                    pinIndex = user.pinIndex
                    highestIndex = administrator.newPinIndex
                    if (pinIndex > 1){
                        pinIndex -= 1
                        user.pinIndex = pinIndex
                    } else {
                        user.pinIndex = highestIndex
                    }
                    user.save()
                    });
                }

                Pin.findOne( { pinIndex : user.pinIndex } ).then( pin => {
                    res.redirect('/');
                });
            });
        });

    // get admin page
    // displays last added pin at top: enlarged and with stats
    // display pins in database
    app.get("/admin", (req,res)=> {
        const admin = true
        const admin_page = true;
        const currentUser = req.user;
        let latestPinIndex;
        let id;


        if (currentUser){
            id = currentUser._id
        }

        User.findOne({_id: id}).then( user => {

            if (user){
                latestPinIndex = user.newPinIndex
            }

            Pin.find().then( pins => {
                Pin.findOne( { pinIndex: latestPinIndex } ).then( latestPin => {
                    slicedPins = pins.slice(0,pins.length-1);
                    pins = slicedPins.reverse();
                    res.render("admin", {currentUser, admin, admin_page, pins, latestPin})
                });
            });
        });
    });

    // add new pin to database
    // redirects to /admin page
    app.get("/add-pins", (req,res)=> {
        let pullPinIndex; // the index to pull from on pinterest.
        const currentUser = req.user;
        const admin = true;

        let title;          //     title: { type: String }, // "og:title": "Leonardo Albiero | Greek statue in 2019 | Vampire the masquerade bloodlines, Vampire art, Gothic vampire”,
        let hexCode;        //     color: { type: String }, // "theme-color": “#e60023”,
        let locale;         //     locale: { type: String }, // "locale": “en-US",
        let description;    //     description: { type: String }, // "og:description": "Leonardo Albiero”,
        let imgUrl;         //     imgURL: { type: String, unique: true }, // "og:image": "https://i.pinimg.com/736x/6f/3b/fe/6f3bfe2b9f35b109b561596f45ca88cc.jpg",
        let imgWidth;       //     imgWidth: { type: Number }, // "og:image:width": "564",
        let imgHeight;      //     imgHeight: { type: Number }, // "og:image:height": "829",
        let pinIndex;       //     pinIndex: { type: Number, unique: true }, // the index of the pin. starts at 0. used when accessing the pin in the app.
        let pinterestUrl;   //     pinterestUrl: { type: String }, // pinterestUrl	string	The URL of the Pin on Pinterest.

        let target; // the target string to look for when searching current_info

        request = require('request');

        if (currentUser){

            User.find({ admin: true }).then ( users => {
                if (users){
                    pullPinIndex = users[0].pullPinIndex
                }


        request("https://api.pinterest.com/v1/me/pins/?access_token=" + process.env.A_TOKEN, function(error, response, body) {

                let current_info = JSON.parse(body);
                console.log(current_info)
                // if the current_info has a message then the app has exceeded
                // its rate limit on calls to Pinterest.
                if (!current_info.message) {
                    pinterestUrl = current_info.data[pullPinIndex].url // need to increment this index and keep track of it with the highestPinIndex variable.
                                                            // pages return pins in increments of 25 (though this can be changed to 100).
                                                            // need to figure out a way of using current_info.cursor or current_info.next(?)
                                                            // to skip ahead to the correct pin once 25/100 pins are in the database.

                    request.get(pinterestUrl, function(error,response,data) {
                        const text = data

                        target =  "\"og:title\": \""
                        title = getData(true, text, target, "\",")
                        console.log(title)

                        target = "\"dominant_color\": \""
                        hexCode = getData(false,text, target, ",")
                        console.log(hexCode)

                        target = "\"locale\": \""
                        locale = getData(false, text, target, ",") // changed this to false
                        console.log(locale)

                        target = "\"og:description\": \""
                        description = getData(false,text, target, ",")
                        console.log(description)

                        target = "og:image\" name=\"og:image\" content=\""
                        imgUrl = getData(false,text,target,">")
                        console.log(imgUrl)

                        target = "og:image:width\": \""
                        imgWidth = getData(false,text,target,",")
                        console.log(imgWidth)

                        target = "og:image:height\": \""
                        imgHeight = getData(false,text,target,",")
                        console.log(imgHeight)

                                pinIndex = users[0].newPinIndex;

                                const new_pin = new Pin()
                                new_pin.title        = title
                                new_pin.hexCode      = hexCode
                                new_pin.locale       = locale
                                new_pin.description  = description
                                new_pin.imgUrl       = imgUrl
                                new_pin.imgWidth     = imgWidth
                                new_pin.imgHeight    = imgHeight
                                // new_pin.pinIndex     = pinIndex // setting this below
                                new_pin.pinterestUrl = pinterestUrl

                                console.log(users[0].freeIndices,"amount of freeIndices",users[0].freeIndices.length > 0)
                                // if users[i].freeIndices.length > 0
                                // pop the last item in the array and use that as the pinIndex
                                    // else increment the newPinIndex by one and use that as the pinIndex
                                if (users[0].freeIndices.length > 0){

                                    for (let i = 0; i < users.length; i++){
                                        pinIndex = users[i].freeIndices.pop() // what if this is for whatever reason different among admins?
                                        users[i].pullPinIndex += 1
                                        users[i].save()
                                        new_pin.pinIndex = pinIndex
                                        console.log("popped" + pinIndex)
                                    }
                                } else {
                                    for (let i = 0; i < users.length; i++){
                                        pinIndex = users[i].newPinIndex
                                        pinIndex += 1
                                        users[i].newPinIndex = pinIndex
                                        users[i].pullPinIndex += 1
                                        users[i].save()
                                        console.log("didn't pop" + pinIndex)
                                    }
                                    console.log("outside if/else statement" + pinIndex)
                                    new_pin.pinIndex = pinIndex
                                }
                                new_pin.save().then( (new_pin) => {
                                        res.redirect("/admin")
                                })
                            });
                        } else { res.redirect("/admin") };
                    });
            });
            } else { res.redirect("/admin") }
     });


     // DELETE THE PIN AND INDEX FROM DATABASE

     // need to get the page indexNumber
     // need to look up and see if there is a pin in the db with that index
        // if there is remove it.
     // need to to push that page index to the 'freeIndices' variable



     // !!!! DELETE ROUTE NEEDS TO DELETE ALL REFERENCES TO THE DELETED PIN IN THE ASSOCIATED LABELS !!!!
     app.get('/delete/:index', (req, res) => {

         const admin_page = false;
         let id;
         let index;
         const currentUser = req.user;

         if (currentUser){
             id = currentUser._id
         }

         User.findOne({_id: id}).then( user => {
             if (user){
                 User.find( { admin : true } ).then( administrators => {
                 index = user.pinIndex
                 if (index){
                     for (let i = 0; i < administrators.length; i++) {
                        notPresent = true;
                        for (let j = 0; j < administrators[i].freeIndices.length; j++){
                            if (index == administrators[i].freeIndices[j]){
                                notPresent = false
                                console.log("Already Present.")
                                break
                            }
                        }
                        if (notPresent){
                            administrators[i].freeIndices.push(index)
                            administrators[i].save()
                        }
                     }
                 }
                     Pin.findOne( { pinIndex : index } ).then( pin => {
                         if (pin){
                             Pin.remove(pin).then((pin) => {
                                    res.redirect('/');
                             })
                         } else {
                             res.redirect('/');
                         }
                     });
                 });
                }
            });
        });

        app.get('/edit/:id', (req, res) => {

            let id;
            let admin;
            let pinIndex;
            const admin_page = false;
            const currentUser = req.user;

            if (currentUser){
                id = currentUser._id
            }

            User.findOne({_id: id}).then( user => {

                if (user){
                    admin = user.admin
                    pinIndex = user.pinIndex
                }

                Pin.findOne({pinIndex : pinIndex}).then( pin => {
                    res.render('edit_info', {currentUser, pin, admin, admin_page, pinIndex});
                });
            });
            });

        app.get('/submit_edit/:pinIndex', (req, res) => {
            let title = req.url.split("=").pop().replace(/\+/g, " ")
            let flagged = req.body
            console.log(title, flagged)

            let id;
            const currentUser = req.user;

            if (currentUser){
                id = currentUser._id
            }

            User.findOne({_id: id}).then( user => {
                Pin.findOne({pinIndex : user.pinIndex}).then( pin => {
                    pin.title = title
                    pin.flagged = false;
                    pin.save().then((pin) => {
                        res.redirect('/');
                    })
                });
            });
    });

            // UPDATE
//     app.put('/starters/:slug', (req, res) => {
//         console.log("googly "+ req.params.slug)
//     var currentUser = req.user;
//     if (req.body.content == ""){
//         Starter.findById(req.params.id).then(starter => {
//         res.render('errorEditStarter', {currentUser, starter}); //NEED TO MAKE AN ERROR PAGE FOR BOTH STARTERS AND THREADS FOR CORRECT REDIRECT
//     });
//     } else {
//         Starter.findOne( {slug: req.params.slug})
//         .then(starter => {
//             console.log("POOOgly "+ starter.slug)
//             starter.content = req.body.content
//       // Starter.findByIdAndUpdate(req.params.id, req.body).then(starter => {
//           starter.authorName = req.user.username
//           starter.author = req.user._id;
//           starter.save()
//           res.redirect(`/starters/${starter.slug}`);
//         })
//         .catch(err => {
//           console.log(err.message)
//         })
//     };
// });

        app.get('/goToPin/:index', (req, res) => {
            let index = req.url.split('/').pop()
            console.log(index)

            let id;
            let pinIndex;
            let admin = true;
            const admin_page = false;
            const currentUser = req.user;

            if (currentUser){
                id = currentUser._id
            }

            User.findOne({_id: id}).then( user => {

                if (user){
                    user.pinIndex = index
                    user.save()
                }

                Pin.findOne({pinIndex : index}).then( pin => {
                    res.redirect('/');
                });
            });
            });

        app.get('/flagPin/:index', (req, res) => {
            let index = req.url.split('/').pop()

                Pin.findOne({pinIndex : index}).then( pin => {
                    if (pin) {
                        pin.flagged = true;
                        pin.save()
                    }
                    res.redirect('/');
                });
            });

};