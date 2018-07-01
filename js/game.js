var fade_speed = 500;
var game_duration = 180;
var shortGameDuration = 60;
var shortGameCategories = 4;
//game_duration = 3; // For testing

var time;
var rounded_time;
var seed_full;
var seed;
var letter_seed;
var gid;
var category;
var letter;
var timer_id;
var current_timer_duration;

// Get a reference to the database service
var database = firebase.database();

$(document).ready(function() {
	$("html,body").animate({ scrollTop: 0 }); // When refreshing, don't start at the bottom of the page by the New Game button.
	$("#extra-rules").on("click", function() {
		$(".extra-rules").show(fade_speed);
	});
	sync();
	$("#button-ready").on("click", function() {
		sync();
	});
	$("#button-start").on("click", function() {
		startGame();
	});
});

function startGame() {
	console.log("Starting game.");
	if ($("#shortGame:checked").length) {
		shortenGame();
	}
	$("#game-phase-landing").hide(fade_speed);
	$("html,body").animate({ scrollTop: 0 });

	var button = $("#timer-control");
	var clock = $(".timer")[0];
	button.on("click", function() {
		hitPause($(this), clock);
	});
	getCards();
	fillCards();

	// Have to manually hide to ensure it comes back as display: inline
	$(".category-score").hide();
	$(".answer-buttons").hide();

	$("#game-phase-main").show(fade_speed);
	timer_id = startTimer(game_duration, clock, button);
}

function shortenGame() {
	game_duration = shortGameDuration;
	var categories = $(".card")
		.not(".score-card")
		.not(".new-game");
	categories.slice((shortGameCategories + 1) * 2).remove();
}

function startScoring() {
	clearInterval(timer_id);

	lockCategory();
	enableScoring();
	showScoring();
	submitAnswers();
}

/*
function remakeGame () {
  $("#game-phase-3").hide(fade_speed);
  nextGame();
  unlockCategory();
  hideScoring();
  $("#game-phase-1").show(fade_speed);
}
*/

function sync() {
	generateSeeds();
	$(".game-id").text(gid);
}

function hitPause(button, timer) {
	console.log("Paused.");
	if (current_timer_duration == 0) {
		button.off("click");
		return;
	}
	button.removeClass("glyphicon-pause");
	button.addClass("glyphicon-play");
	button.off("click");

	clearInterval(timer_id);
	button.on("click", function() {
		hitStart(button, timer);
	});
}

function hitStart(button, timer) {
	console.log("Playing.");
	button.removeClass("glyphicon-play");
	button.addClass("glyphicon-pause");
	button.off("click");
	timer_id = startTimer(current_timer_duration, timer, button);
	button.on("click", function() {
		hitPause(button, timer);
	});
}

function startTimer(duration, display, button) {
	var start = Date.now(),
		diff,
		minutes,
		seconds;
	function timer() {
		// get the number of seconds that have elapsed since
		// startTimer() was called
		diff = duration - (((Date.now() - start) / 1000) | 0);
		current_timer_duration = diff;

		// does the same job as parseInt truncates the float
		minutes = (diff / 60) | 0;
		seconds = (diff % 60) | 0;

		if (minutes == 0 && seconds < 30) {
			$(display).addClass("low-timer");
		}

		minutes = minutes < 10 ? "0" + minutes : minutes;
		seconds = seconds < 10 ? "0" + seconds : seconds;

		display.textContent = minutes + ":" + seconds;

		if (diff <= 0) {
			// add one second so that the count down starts at the full duration
			// example 05:00 not 04:59
			start = Date.now() + 1000;
		}
		if (minutes == 0 && seconds == 0) {
			clearInterval(timer_id);
			button.hide();
			startScoring();
		}
	}
	// we don't want to wait a full second before the timer starts
	timer();
	return setInterval(timer, 1000);
}

function getCards() {
	category = categories[Math.floor(seed * categories.length)];
	letter = letters[Math.floor(letter_seed * letters.length)];
}
function fillCards() {
	$(".category").each(function(index) {
		$(this).text(category[index]);
	});
	$(".letter").text(letter);
}

function lockCategory() {
	$(".category-input").each(function() {
		$(this).attr("readonly", 1);
	});
}

function showScoring() {
	$(".new-game").show();
	$(".answer-buttons").show();
	$(".category-score").show();
	$(".score-card").show();
}
function enableScoring() {
	$(".downvote").on("click", function() {
		updateScoring(this, 0);
	});
	$(".upvote").on("click", function() {
		updateScoring(this, 1);
	});
}
function updateScoring(button, direction) {
	console.log("Direction: " + direction);
	console.log(".category-score: ");
	var score_element = $(button)
		.parent()
		.siblings(".category-score")
		.find(".category-score-text");
	console.log(score_element);
	var score = score_element.text();
	console.log(score);
	var total = $(".total-score");
	if (score === "?") {
		score = 0;
	}
	if (direction == 1) {
		score++;
		total.text(parseInt(total.text()) + 1);
	} else if (score > 0) {
		score--;
		total.text(parseInt(total.text()) - 1);
	}
	console.log("Changing score to: " + score);
	score_element.text(score);

	var input = $(button)
		.parent()
		.siblings(".category-input");
	if (score > 0) {
		input.removeClass("score-zero");
		input.addClass("score-nonzero");
	} else {
		input.removeClass("score-nonzero");
		input.addClass("score-zero");
	}
}
function submitAnswers() {
	// Arrange categories with answers
	var categories = [];
	var answers = [];
	$(".category").each(function() {
		categories.push($(this).text());
	});
	$(".category-input").each(function() {
		answers.push($(this).val());
	});
	var content = {};
	for (var i = 0; i < categories.length; i++) {
		content[categories[i]] = answers[i];
	}

	// Ensure seed is set up
	var submissionRef = firebase.database().ref("submissions/" + seed_full);
	submissionRef.update({
		letter: letter,
	});

	// Create an entry for this seed
	var newPostRef = submissionRef.push();
	newPostRef.set(content);
	var submissionKey = newPostRef.key;

	// Add answers to the category
	for (var i = 0; i < categories.length; i++) {
		if (answers[i] === "") {
			continue;
		}
		firebase
			.database()
			.ref(
				"categories/" +
					categories[i] +
					"/" +
					letter +
					"/" +
					seed_full +
					"/" +
					submissionKey
			)
			.set(answers[i]);
	}
}

function generateSeeds() {
	// Use the sin of time as a seed that changes every two minutes.
	time = Date.now() / 1000 / 60; // Milliseconds -> minutes
	rounded_time = time & ~1; // Round down to nearest even integer, e.g. 24845658
	seed_full = rounded_time.toString();
	gid = seed_full.slice(-3);
	seed = calcSeed(rounded_time); // e.g. 0.20733307350520097
	letter_seed = calcSeed(rounded_time + 2); // e.g. 0.20733307350520097

	// Since we multiply seeds by array lengths to get indices, never allow seed to be 1. (Length 3 * Seed 1 = Index 3)
	if (seed == 1) {
		seed = 0;
	}
	if (letter_seed == 1) {
		letter_seed = 0;
	}
	console.log("Rounded Time " + rounded_time);
	console.log("Seed: " + seed);
	console.log("Letter Seed: " + letter_seed);
}

function nextGame() {
	rounded_time += 2;
	generateSeeds();
	startGame();
}

function shuffle(array, seed) {
	let length = array.length;
	let count = 0;
	let shuffleTo;
	let temp;
	while (count !== length - 1 && seed) {
		shuffleTo = seed % (length - count);
		seed = (seed - shuffleTo) / (length - count);
		temp = array[count];
		array[count] = array[count + shuffleTo];
		array[count + shuffleTo] = temp;
		count++;
	}
	return array;
}

function calcSeed(time) {
	var seed = Math.sin(time);
	seed = seed > 0 ? seed : seed * -1;
	return seed;
}

var letters = [
	"A",
	"B",
	"C",
	"D",
	"E",
	"F",
	"G",
	"H",
	"I",
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"R",
	"S",
	"T",
	"W",
];

// Categories can't contain ".", "#", "$", "/", "[", or "]"
var categories = [
	[
		"A Boy's Name",
		"U.S. Cities",
		"Things That Are Cold",
		"School Supplies",
		"Pro Sports Teams",
		"Insects",
		"Breakfast Foods",
		"Furniture",
		"TV Shows",
		"Things Found In The Ocean",
		"Presidents",
		"Product Names",
	],
	[
		"Vegetables",
		"States",
		"Things You Throw Away",
		"Occupations",
		"Appliances",
		"Cartoon Characters",
		"Types Of Drink",
		"Musical Groups",
		"Store Names",
		"Things At A Football Game",
		"Trees",
		"Personality Traits",
	],
	[
		"Articles Of Clothing",
		"Desserts",
		"Car Parts",
		"Things Found On A Map",
		"Athletes",
		"4-Letter Words",
		"Items In A Refrigerator",
		"Farm Animals",
		"Street Names",
		"Things At The Beach",
		"Colors",
		"Tools",
	],
	[
		"Sports",
		"Song Titles",
		"Parts Of The Body",
		"Ethnic Foods",
		"Things You Shout",
		"Birds",
		"A Girl's Name",
		"Ways To Get From Here To There",
		"Items In A Kitchen",
		"Villains Or Monsters",
		"Flowers",
		"Things You Replace",
	],
	[
		"Sandwiches",
		"Items In A Catalog",
		"World Leaders Or Politicians",
		"School Subjects",
		"Excuses For Being Late",
		"Ice Cream Flavors",
		"Things That Jump Or Bounce",
		"Television Stars",
		"Things In A Park",
		"Foreign Cities",
		"Stones Or Gems",
		"Musical Instruments",
	],
	[
		"Things That Are Sticky",
		"Awards Or Ceremonies",
		"Cars",
		"Spices Or Herbs",
		"Bad Habits",
		"Cosmetics Or Toiletries",
		"Celebrities",
		"Cooking Utensils",
		"Reptiles Or Amphibians",
		"Parks",
		"Leisure Activities",
		"Things You're Allergic To",
	],
	[
		"Fictional Characters",
		"Menu Items",
		"Magazines",
		"Capitals",
		"Kinds Of Candy",
		"Items You Save Up To Buy",
		"Footwear",
		"Something You Keep Hidden",
		"Items In A Suitcase",
		"Things With Tails",
		"Sports Equipment",
		"Crimes",
	],
	[
		"Nicknames",
		"Things In The Sky",
		"Pizza Toppings",
		"Colleges Or Universities",
		"Fish",
		"Countries",
		"Things That Have Spots",
		"Historical Figures",
		"Something You're Afraid Of",
		"Terms Of Measurement",
		"Items In This Room",
		"Book Titles",
	],
	[
		"Restaurants",
		"Notorious People",
		"Fruits",
		"Things In A Medicine Cabinet",
		"Toys",
		"Household Chores",
		"Bodies Of Water",
		"Authors",
		"Halloween Costumes",
		"Weapons",
		"Things That Are Round",
		"Words Associated With Exercise",
	],
	[
		"Heroes",
		"Gifts Or Presents",
		"Terms Of Endearment",
		"Kinds Of Dances",
		"Things That Are Black",
		"Vehicles",
		"Tropical Locations",
		"College Majors",
		"Dairy Products",
		"Things In A Souvenir Shop",
		"Items In Your Purse Or Wallet",
		"World Records",
	],
	[
		"Baby Foods",
		"Famous Duos And Trios",
		"Things Found In A Desk",
		"Vacation Spots",
		"Diseases",
		"Words Associated With Money",
		"Items In A Vending Machine",
		"Movie Titles",
		"Games",
		"Things That You Wear",
		"Beers",
		"Things At A Circus",
	],
	[
		"Famous Females",
		"Medicine Or Drugs",
		"Things Made Of Metal",
		"Hobbies",
		"People In Uniform",
		"Things You Plug In",
		"Animals",
		"Languages",
		"Names Used In The Bible",
		"Junk Food",
		"Things That Grow",
		"Companies",
	],
	[
		"Things At A Picnic",
		"Things That Are Soft",
		"Things In A Science Fiction Movie",
		"Things At The White House",
		"Things That Kids Play With",
		"Things At A Wedding",
		"Hot Places",
		"Things In Outer Space",
		"Found In A College Dorm",
		"Things At A Diner",
		"Famous Singers",
		"Things At An Amusement Park",
	],
	[
		"Worn Above The Waist",
		"Things That Are Bright",
		"Things That Have Numbers",
		"Found In A Gym Or Health Club",
		"Things On A Safari",
		"Ways To Say Hi And Bye",
		"Things From The Sixties",
		"Holiday Things",
		"Items In An Office",
		"Things In Pairs Or Sets",
		"Things On A Highway",
		"Things In Las Vegas",
	],
	[
		"Things At A Zoo",
		"Things With Motors",
		"Things That Fly",
		"Found At A Salad Bar",
		"Things On A Hiking Trip",
		"Things In A Hotel",
		"Healthy Foods",
		"Found In A Classroom",
		"Party Things",
		"Reasons To Skip School Or Work",
		"Titles People Have",
	],
	[
		"Things In A Desert",
		"Things In A Mystery Novel",
		"Computer Lingo",
		"Loud Things",
		"Kinds Of Soups Or Stews",
		"Math Terms",
		"Underground Things",
		"Things In The Wild West",
		"Things In An Airport",
		"Words With Double Letters",
		"Found In New York City",
		"Things In Fairy Tales",
	],
];
