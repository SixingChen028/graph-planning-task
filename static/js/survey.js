/*
DEPENDENCIES

  (jquery)
  <link href="https://unpkg.com/survey-jquery/defaultV2.min.css" type="text/css" rel="stylesheet">
  <script src="https://unpkg.com/survey-jquery/survey.jquery.min.js"></script>
*/

const EXAMPLE_SURVEY = {
 "logoPosition": "right",
 "pages": [
  {
   "name": "page1",
   "elements": [
    {
     "type": "matrix",
     "name": "question1",
     "title": "What is your name?",
     "columns": [
      "Column 1",
      "Column 2",
      "Column 3"
     ],
     "rows": [
      "Row 1",
      "Row 2"
     ]
    }
   ]
  },
  {
   "name": "page2",
   "elements": [
    {
     "type": "radiogroup",
     "name": "question2",
     "title": "How are you doing",
     "choices": [
      "Item 1",
      "Item 2",
      "Item 3"
     ]
    }
   ]
  }
 ]
}



class SurveyTrial {
  constructor(json) {
    window.ST = this
    logEvent('survey.construct', {json})
    this.survey = new Survey.Model(json);
    this.results = makePromise()
    this.survey.onComplete.add((sender) => this.results.resolve(sender.data));

    this.width = 1000

    this.el = $('<div>', {id: '_survey_target'})
    .css({width: this.width, margin: 'auto'})

    // Enable markdown in questions
    let converter = new showdown.Converter();
    this.survey.onTextMarkdown.add(function(survey, options) {
      //convert the mardown text to html
      var str = converter.makeHtml(options.text);
      //remove root paragraphs <p></p>
      str = str.substring(3);
      str = str.substring(0, str.length - 4);
      //set html
      options.html = str;
    });
  }

  async run(element) {
    logEvent('survey.run')
    element.empty()
    this.el.appendTo(element)
    this.survey.render('_survey_target');
    let results = await this.results
    logEvent('survey.results', {results})
  }
}
