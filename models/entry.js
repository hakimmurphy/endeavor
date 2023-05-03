const mongoose = require('mongoose')
const review = require('./review')
const Schema = mongoose.Schema

const ImageSchema = new Schema({
    url: String,
    filename: String
})

const opts = { toJSON: { virtuals: true } }

const EntrySchema = new Schema({
    images: [ImageSchema],
    title: String,
    artist: String,
    description: String,
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
    ,
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Review'
        }
    ]
}, opts)

EntrySchema.post('findOnedAndDelete', async function (doc) {
    if (doc) {
        await review.deleteMany({
            _id: {
                $in: doc.reviews
            }
        })
    }
})

module.exports = mongoose.model('Entry', EntrySchema)

