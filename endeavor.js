if (process.env.NODE_ENV !== "production") {
    require('dotenv').config()
}

const express = require('express')
const path = require('path')
const mongoose = require('mongoose')
const ejsMate = require('ejs-mate')
const session = require('express-session')
const flash = require('connect-flash')
const multer = require('multer')
const { cloudinary, storage } = require('./cloudinary')
const upload = multer({ storage })
const methodOverride = require('method-override')
const passport = require('passport')
const LocalStrategy = require('passport-local')

const mongoSanitize = require('express-mongo-sanitize')

const ExpressError = require('./utils/ExpressError')
const catchAsync = require('./utils/catchAsync')

const { isloggedIn, validateEntry, isAuthor, isReviewAuthor, validateReview } = require('./middleware')

const User = require('./models/user')
const Entry = require('./models/entry')
const Review = require('./models/review')

const MongoStore = require('connect-mongo')

const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/endeavor'
mongoose.connect(dbUrl, {})

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
})

const app = express()

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(mongoSanitize({
    replaceWith: '_'
}))

const secret = process.env.SECRET

const store = MongoStore.create({
    mongoUrl: dbUrl,
    secret,
    touchAfter: 24 * 60 * 60
})

store.on('error', function (e) {
    console.log('SESSION STORE ERROR!', e)
})

const sessionConfig = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}
app.use(session(sessionConfig))
app.use(flash())

app.use(passport.initialize())
app.use(passport.session())
passport.use(new LocalStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

app.use((req, res, next) => {
    if (!['/login', '/'].includes(req.originalUrl)) {
        req.session.returnTo = req.originalUrl
    }
    res.locals.currentUser = req.user
    res.locals.success = req.flash('success')
    res.locals.error = req.flash('error')
    next()
})

// register routes

app.get('/register', (req, res) => {
    res.render('register')
})

app.post('/register', catchAsync(async (req, res, next) => {
    try {
        const { email, username, password } = req.body
        const user = new User({ email, username })
        const registeredUser = await User.register(user, password)
        req.login(registeredUser, err => {
            if (err) return next(err)
            req.flash('success', 'Welcome to Endeavor')
            res.redirect('/')
        })
    } catch (e) {
        req.flash('error', e.message)
        res.redirect('/register')
    }
}))

// login routes

app.get('/login', (req, res) => {
    res.render('login')
})

app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login', keepSessionInfo: true }), (req, res) => {
    req.flash('success', 'Welcome Back!')
    const redirectUrl = req.session.returnTo || '/'
    delete req.session.returnTo
    res.redirect('/')
})

// logout route

app.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err)
        req.flash('success', 'Goodbye!')
        res.redirect('/')
    })
})

//Contact Route

app.get('/contact', (req, res) => {
    res.render('contact')
})

//entry routes

app.get('/', catchAsync(async (req, res) => {
    const entries = await Entry.find({})
    res.render('index', { entries })
}))

app.get('/new', isloggedIn, (req, res) => {
    res.render('new', { title: 'Make New Entry' })
})

app.post('/', isloggedIn, upload.array('image'), catchAsync(async (req, res) => {
    const entry = new Entry(req.body)
    entry.images = req.files.map(f => ({ url: f.path, filename: f.filename }))
    entry.author = req.user._id
    await entry.save()
    console.log(entry)
    req.flash('success', 'Made a new entry!')
    res.redirect('/')
}))

app.get('/:id', catchAsync(async (req, res) => {
    const entry = await Entry.findById(req.params.id).populate({
        path: 'reviews',
        populate: {
            path: 'author'
        }
    }).populate('author')
    console.log(entry)
    res.render('show', { entry, title: `${entry.artist} - ${entry.title}` })
}))

app.get('/:id/edit', isloggedIn, isAuthor, catchAsync(async (req, res) => {
    const { id } = req.params
    const entry = await Entry.findById(id)
    res.render('edit', { entry, title: 'Edit An Entry' })
}))

app.put('/:id', isloggedIn, isAuthor, upload.array('image'), catchAsync(async (req, res) => {
    const { id } = req.params
    const entry = await Entry.findByIdAndUpdate(id, { ...req.body })
    const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }))
    entry.images.push(...imgs)
    await entry.save()
    req.flash('success', 'Successfully updated the entry!')
    res.redirect(`/${entry._id}`)
}))

app.delete('/:id', isloggedIn, isAuthor, catchAsync(async (req, res) => {
    try {
        const { id } = req.params
        const entry = await Entry.findById(id, { ...req.body })
        const filename = entry.images.map(function (el) {
            return el.filename
        })
        await cloudinary.uploader.destroy(filename)
        // await entry.updateOne({ $pull: { images: { filename: { $in: Entry.images } } } })
        await entry.remove()
    } catch (e) {
        console.log(e)
    }
    req.flash('success', 'Successfully deleted!')
    res.redirect('/')
}))

// review routes

app.post('/:id/reviews', isloggedIn, validateReview, catchAsync(async (req, res) => {
    const entry = await Entry.findById(req.params.id)
    const review = new Review(req.body)
    review.author = req.user._id
    entry.reviews.push(review)
    await review.save()
    await entry.save()
    req.flash('success', 'Created new review!')
    res.redirect(`/${entry._id}`)
}))

app.delete('/:id/reviews/:reviewId', isloggedIn, isReviewAuthor, catchAsync(async (req, res) => {
    const { id, reviewId } = req.params
    await Entry.findByIdAndUpdate(id, { $pull: { reviews: reviewId } })
    await Review.findByIdAndDelete(reviewId)
    req.flash('success', 'Successfully deleted review!')
    res.redirect(`/${id}`)
}))

// Error Handling


app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404))
})

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!';
    res.status(statusCode).render('error', { err })
})


const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Serving on port ${port}`)
})