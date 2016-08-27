// Initialize Express app
var express = require('express');
var app = express();

// Scraping tools:
var request = require('request');
var cheerio = require('cheerio');

// Other dependencies
var logger = require('morgan');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');

// Use morgan and bodyparser with our app
app.use(logger('dev'));
app.use(bodyParser.urlencoded(
	{
		extended: false
	}
));

// Make public a static directory
app.use(express.static(process.cwd() + '/public'));

// Set up Handlebars
var exphbs = require('express-handlebars');
app.engine('handlebars', exphbs
		(
			{
				defaultLayout: 'main'
			}
		)
);
app.set('view engine', 'handlebars');

// Database configuration with Mongoose
mongoose.connect
	(
		'mongodb://localhost/bidendb'
	);
var db = mongoose.connection;

// Show any Mongoose errors
db.on('error', function(err)
	{
		console.log('Mongoose Error: ', err);
	}
);

// Once logged in to the db through Mongoose, log a success message
db.once('open', function()
	{
		console.log('Mongoose connection successful.');
	}
);

// And we bring in our Note and Article models
var Note = require('./models/Note.js');
var Article = require('./models/Article.js');

// Routes
// ========================================

// Simple index route
app.get('/', function(req, res)
	{
		res.render('index');
	}
);

// A GET request to scrape the echojs website.
app.get('/scrape', function(req, res)
	{
		// first, we grab the body of the html with request
		request('http://www.theonion.com/search?q=joe+biden', function(error, response, html)
			{
				if (error || response.statusCoe != 200)
					{
						console.log(error);
					}
				else
					{
						// save an empty result object
						var result = {};

						// then, we load that into cheerio and save it to $ for a shorthand selector
						var $ = cheerio.load(html);

						// now, we grab every h2 within an article tag, and do the following:
						$('h2.headline').each(function(i, element)
							{
								// add the text and href of every link, and save them as properties of the result obj
								result.title = $(element).find('a').attr('title');
								result.link = 'http://www.theonion.com' + $(element).find('a').attr('href');

								// using our Article model, create a new entry. Notice the (result): This effectively passes the result object to the entry (and the title and link)
								var entry = new Article (result);

								// now, save that entry to the db
								entry.save(function(err, doc)
									{
										// log any errors
										if (err)
											{
												console.log(err);
											} 
										// or log the doc
										else
											{
												console.log(doc);
											}
									}
								);
							}
						);
					}
			}
		);
		// tell the browser that we finished scraping the text.
		console.log("Scrape Complete");
		res.redirect("/");
	}
);

// this will get the articles we scraped from the mongoDB
app.get('/articles', function(req, res)
	{
		// grab every doc in the Articles array
		Article.find({}, function(err, doc)
			{
				// log any errors
				if (err)
					{
						console.log(err);
					} 
				// or send the doc to the browser as a json object
				else
					{
						res.json(doc);
					}
			}
		);
	}
);

// grab an article by it's ObjectId
app.get('/articles/:id', function(req, res)
	{
		// using the id passed in the id parameter, prepare a query that finds the matching one in our db...
		Article.findOne({'_id': req.params.id})
		// and populate all of the notes associated with it.
		.populate('note')
		// now, execute our query
		.exec(function(err, doc)
			{
				// log any errors
				if (err)
					{
						console.log(err);
					} 
				// otherwise, send the doc to the browser as a json object
				else
					{
						res.json(doc);
					}
			}
		);
	}
);


// replace the existing note of an article with a new one or if no note exists for an article, make the posted note it's note.
app.post('/articles/:id', function(req, res)
	{
		// create a new note and pass the req.body to the entry.
		var newNote = new Note(req.body);
		// and save the new note the db
		newNote.save(function(err, doc)
			{
				// log any errors
				if(err)
					{
						console.log(err);
					} 
				// otherwise
				else
					{
						// using the Article id passed in the id parameter of our url, prepare a query that finds the matching Article in our db and update it to make it's lone note the one we just saved
						Article.findOneAndUpdate(
							{
								'_id': req.params.id
							},{
								'note':doc._id
							}
						)
						// execute the above query
						.exec(function(err, doc)
							{
								// log any errors
								if (err)
									{
										console.log(err);
									}
								else
									{
										// or send the document to the browser
										res.send(doc);
									}
							}
						);
					}
			}
		);
	}
);

// listen on port 3000
// ========================================
var PORT = process.env.PORT || 3000
app.listen(PORT, function(){
	console.log("Listening at Port " + PORT)
});