const { entrySchema, reviewSchema } = require('./schemas.js')
const ExpressError = require('./utils/ExpressError')
const Entry = require('./models/entry')
const Review = require('./models/review')


module.exports.isloggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login')
    }
    next()
}

module.exports.validateEntry = (req, res, next) => {
    const { error } = entrySchema.validate(req.body)
    if (error) {
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    } else {
        next()
    }
}

module.exports.isAuthor = async (req, res, next) => {
    const { id } = req.params
    const entry = await Entry.findById(id)
    if (!entry.author.equals(req.user.id)) {
        return res.redirect(`/${id}`)
    }
    next()
}

module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params
    const review = await Review.findById(reviewId)
    if (!review.author.equals(req.user.id)) {
        return res.redirect(`/${id}`)
    }
    next()
}

module.exports.validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body)
    if (error) {
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    } else {
        next()
    }
}