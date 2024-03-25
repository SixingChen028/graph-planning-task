
// default names; you should probably pass names though
const _input_counters = {}
function nextInputName(type) {
  let name = {
    'Button': 'button',
    'TextBox': 'text',
    'RadioButton': 'radio',
    'Slider': 'slider',
  }[type]
  let n = _input_counters[name] ?? 1
  _input_counters[name] = n + 1
  return name + n
}

function getInputValues(obj) {
  return _.mapValues(obj, o=>o.val())
}

class Input {
  constructor({name = undefined} = {}) {
    this.div = $('<div>')
    this.name = name ?? nextInputName(this.constructor.name)
  }
  appendTo(div) {
    this.div.appendTo(div)
    return this
  }
  remove() {
    this.div.remove()
  }
}


class Button extends Input {
  constructor({text = 'continue', delay = 100, name=undefined, persistent=true, css = {}, cls=undefined} = {}) {
    super({name})
    this.div.css('text-align', 'center')
    this.button = $('<button>', {class: 'btn btn-primary'})
    .text(text)
    .css(css)
    .addClass(cls)
    .appendTo(this.div)

    window.btn = this.button


    this.clicked = makePromise()
    this.button.click(async () => {
      this.button.prop('disabled', true)
      logEvent('input.button.click', {name: this.name, text})
      await sleep(delay)
      this.clicked.resolve()
      if (!persistent) {
        this.button.remove()
      }
    })
  }
  promise() {
    return this.clicked
  }
  click(f) {
    this.button.click(f)
    return this
  }
  css(...args) {
    this.button.css(...args)
    return this
  }
}


class TextBox extends Input {
  constructor({height=100, width='500px', prompt='', name=undefined} = {}) {
    super({name})
    this.prompt = $("<p>")
    .css('margin-top', 20)
    .html(prompt)
    .appendTo(this.div)

    this.textarea = $('<textarea>')
    .css({
      // margin: '10px 10%',
      padding: '10px',
      width,
      height
    })
    .appendTo(this.div)
    .focus()
    .focus(() => logEvent('input.text.focus', {name: this.name}))


    this.textarea.blur(() => {
      logEvent('input.text.blur', {name: this.name, text: this.val()})
    })
  }
  val() {
    return this.textarea.val()
  }
}

class RadioButtons extends Input {
  constructor({prompt='', choices=['yes', 'no'], name=undefined}={}) {
    super({name})

    this.prompt = $("<p>")
    .css('margin-top', 20)
    .html(prompt)
    .appendTo(this.div)

    let btnDiv = $('<div>').appendTo(this.div)
    for (let choice of choices) {
      $('<input>').attr({
        type: 'radio',
        id: choice,
        name: this.name,
        value: choice,
       }).appendTo(btnDiv)
      .click(() => logEvent('input.radio.click', {name: this.name, value: choice}))

       $('<label>')
       .attr('for', this.name + choice)
       .text(choice)
       .css({marginLeft: 5, marginRight: 10})
       .appendTo(btnDiv)
    }
  }

  promise() {
    let promise = makePromise()
    this.buttons().click(() => promise.resolve(this.val()))
    return promise
  }
  buttons() {
    return $(`input[name="${this.name}"]`)
  }
  val() {
    return $(`input[name="${this.name}"]:checked`).val()
  }
  click(f) {
    this.buttons().click(() => {
      f(this.val())
    })
  }
}

class Slider extends Input {
  constructor({prompt='', min=0, max=100, step=1, value=50, name=undefined, leftLabel='', rightLabel=''}={}) {
    super({name});

    this.prompt = $("<p>")
      .css('margin-top', 20)
      .html(prompt)
      .appendTo(this.div);

    // Create container div to hold the slider and labels
    this.sliderContainer = $('<div>').appendTo(this.div).css({
      width: 500, marginBottom: 50,
    });

    this.slider = $('<input>')
      .attr({
        type: 'range',
        min: min,
        max: max,
        step: step,
        value: value,
        id: this.name
      })
      .appendTo(this.sliderContainer)
      .on('change', () => {
        logEvent('input.slider.change', {name: this.name, value: this.slider.val()});
      });

    this.leftLabel = $('<label>')
      .text(leftLabel)
      .appendTo(this.sliderContainer)
      .css({
        // 'display': 'block',
        float: 'left',
        // 'text-align': 'center'
      });

    this.rightLabel = $('<label>')
      .text(rightLabel)
      .appendTo(this.sliderContainer)
      .css({
        float: 'right',
        // 'display': 'block',
        // 'text-align': 'center'
      });

  }

  promise() {
    let promise = makePromise();
    this.slider.on('input', () => promise.resolve(this.val()));
    return promise;
  }

  val() {
    return this.slider.val();
  }

  change(callback) {
    this.slider.on('input', () => {
      callback(this.val());
    });
  }
}

function text_box(div, prompt, opts) {
  return new TextBox({prompt, ...opts}).appendTo(div)
}

function button(div, text, opts) {
  return new Button({text, ...opts}).appendTo(div)
}

function radio_buttons(div, prompt, choices, opts) {
  return new RadioButtons({prompt, choices, ...opts}).appendTo(div)
}


function alert_success(opts = {}) {
  let flavor = _.sample([
    "you're on fire", "top-notch stuff", "absolutely brilliant",
    "out of this world", "phenomenal", "you've outdone yourself", "A+ work",
    "nailed it", "rock star status", "most excellent", "impressive stuff",
    "smashed it", "genius", "spot on", "gold, pure gold",
    "bang-up job", "exceptional", "superb", "you're a natural", "knocked it out of the park"
  ])
  return Swal.fire({
    title: 'Success!',
    html: `<em>${flavor}!</em>`,
    icon: 'success',
    confirmButtonText: 'Continue',
    ...opts
  })
}

function alert_failure(opts = {}) {
  let flavor = _.sample([
    "better luck next time",
    "shake it off and try again",
    "failure is the spice that gives success its flavor",
    "just a little detour on the road to greatness",
    "everyone likes an underdog, get back in there"
  ])
  return Swal.fire({
    title: "Let's try the next one",
    html: `<em>${flavor}!</em>`,
    icon: 'error',
    confirmButtonText: 'Continue',
    ...opts
  })
}

class TopBar {
    constructor(options = {}) {
    _.defaults(options, {
      nTrial: undefined,
      // score: false,
      // time: -1,
      width: 1100,
      height: 100,
      help: '',
    })
    Object.assign(this, options)

    this.div = $('<div>')
    .css({
      height: this.height,
      width: this.width,
      margin: 'auto',
      position: 'relative',
      userSelect: 'none',
      // border: 'thin red solid',
      // 'margin-bottom': '20px',
      // 'margin-top': '20px'
    })

    if (this.nTrial) {
      this.counter = $('<div>')
      .addClass('left')
      .css({
        position: 'absolute',
        bottom: 0,
        fontWeight: 'bold',
        fontSize: '16pt'
      })
      .appendTo(this.div)
      this.count = 1
      this.setCounter(this.count)
    }

    if (this.help) {
      this.helpButton = $('<button>')
      .appendTo(this.div)
      .addClass('btn-help')
      .text('?')
      .click(async () => {
        await Swal.fire({
            title: 'Instructions',
            html: this.help,
            icon: 'info',
            confirmButtonText: 'Got it!',
          })
      })
    }
    // this.prompt = $('<div>').css({
    //   'max-width': 700,
    //   'height': 120,
    //   'margin': 'auto',
    // }).appendTo(this.div)
  }

  prependTo(display) {
    this.div.prependTo(display)
    return this
  }

  setCounter(count) {
    this.count = count
    this.counter.text(`Round ${this.count} / ${this.nTrial}`)
  }

  incrementCounter() {
    this.setCounter(this.count + 1)
  }
}


class Timer {
  constructor(options={}) {
    _.defaults(options, {
      time: 10,
      countUp: false,
      label: '',
    })
    Object.assign(this, options)
    this.span = null
    this.done = false
  }


  attach(div) {
    this.span = $('<span>').appendTo(div).css({
      fontSize: 24
    })
    this.css = (x) => this.span.css(x)
    this.updateDisplay()
    return this
  }

  updateDisplay() {
    this.span.html(this.label + this.fmtTime(this.time))
  }

  fmtTime(secs) {
    var minutes = Math.floor((secs) / 60);
    var seconds = secs - (minutes * 60);

    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return minutes+':'+seconds;
  }

  pause() {
    logEvent('timer.pause')
    this.paused = true
  }
  unpause() {
    logEvent('timer.unpause')
    this.paused = false
  }

  async run(display) {
    logEvent('timer.start')
    if (display) this.attach(display)
    while (this.time != 0) {
      await sleep(1000)
      if (this.paused) continue
      this.time -= 1
      if (this.span) {
        this.updateDisplay()
      }
    }
    this.done = true
    logEvent('timer.done')
  }
};

class Score {
  constructor(options={}) {
    _.defaults(options, {
      score: 0,
      label: 'Score: ',
      bonus: null
    })
    Object.assign(this, options)
    logEvent('score.initialize', {score: this.score})
  }

  attach(div) {
    this.span = $('<span>').appendTo(div).css({
      fontSize: 24
    })
    this.css = (x) => this.span.css(x)
    this.updateDisplay()
    return this
  }

  updateDisplay() {
    this.span.html(this.label + this.score)
  }

  addPoints(points) {
    this.score += points
    logEvent('score.add', {score: this.score, points})
    this.updateDisplay()
    if (this.bonus) {
      this.bonus.addPoints(points)
    }
  }
};


class CycleViewer {
  constructor(div, items, onShow) {
    this.items = items
    this.onShow = onShow.bind(this)

    this.div = $('<div>').css({
      'position': 'relative',
      'margin': 'auto',
      'width': '1200px',
      'text-align': 'center',
    }).appendTo(div)


    this.top = $("<div>")
    .css('margin-bottom', 20)
    .appendTo(this.div)


    this.btnPrev = $('<button>')
    .addClass('btn')
    .text('<<')
    .css({
      display: 'inline-block',
    })
    .appendTo(this.top)

    this.title = $('<h2>').css({
      'margin-left': 30,
      'margin-right': 30,
      'display': 'inline-block',
      'min-width': 200
    }).appendTo(this.top)

    this.btnNext = $('<button>')
    .addClass('btn')
    .text('>>')
    .css({
      display: 'inline-block',
    })
    .appendTo(this.top)

    this.content = $('<div>').css({
      'width': '1200px',
      // border: 'thick black solid'
    }).appendTo(this.div)
    this.listener = new EventListeners()
  }

  setTitle(txt) {
    this.title.text(txt)
  }

  showItem(i) {
    this.onShow(this.items[i])
    this.btnPrev.unbind('click')
    this.btnPrev.click(() => {
      this.showItem(mod(i - 1, this.items.length))
    })
    this.btnNext.unbind('click')
    this.btnNext.click(() => {
      this.showItem(mod(i + 1, this.items.length))
    })
    this.listener.on('keydown', event => {
      if (event.key === "ArrowLeft") {
        this.listener.clear()
        this.showItem(mod(i - 1, this.items.length))
      }
      else if (event.key === "ArrowRight") {
        this.listener.clear()
        this.showItem(mod(i + 1, this.items.length))
      }
    })
  }
}

class Instructions {
  constructor(options={}) {
    this.options = _.defaults(options, {
      width: 1000,
      promptHeight: 100,
      helpText: DEFAULT_INSTRUCT_HELP
    })

    this.div = $('<div>')
    .css({
      width: options.width,
      position: 'relative',
      margin: 'auto',
      padding: '10px',
    })

    let help = $('<button>')
    .appendTo(this.div)
    .addClass('btn-help')
    .text('?')
    .click(async () => {
      await Swal.fire({
          title: 'Help',
          html: options.helpText,
          icon: 'info',
          confirmButtonText: 'Got it!',
        })
    })

    this.btnPrev = $('<button>')
    .addClass('btn')
    .text('<<')
    .css({
      position: 'absolute',
      top: '20px',
      left: '0px',
    })
    .click(() => this.runPrev())
    .prop('disabled', true)
    .appendTo(this.div)

    this.btnNext = $('<button>')
    .addClass('btn')
    .text('>>')
    .css({
      position: 'absolute',
      top: '20px',
      right: '0px',
    })
    .click(() => this.runNext())
    .prop('disabled', true)
    .appendTo(this.div)

    this.textDiv = $("<div>").css({marginLeft: 50}).appendTo(this.div)
    this.title = $('<h1>').addClass('text').appendTo(this.textDiv)

    this.prompt = $('<div>')
    .addClass('text instructions')
    .css({
      height: options.promptHeight,
      marginTop: 20
    })
    .appendTo(this.textDiv)

    this.content = $('<div>').appendTo(this.div)

    this.stage = 0
    this.maxStage = 0
    this.stages = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    .filter(f => f.startsWith('stage'))
    .map(f => this[f])

    this.completed = makePromise()

  }

  attach(display) {
    display.empty()
    this.div.appendTo(display)
    return this
  }

  async run(display, stage) {
    if (display) this.attach(display)
    if (stage == undefined && urlParams.instruct) {
      stage = parseInt(urlParams.instruct)
    }
    this.runStage(stage ?? 1)
    await this.completed
  }

  sleep(ms) {
    // this allows us to cancel sleeps when the user flips to a new page
    this._sleep = makePromise()
    sleep(ms).then(() => this._sleep.resolve())
    return this._sleep
  }

  setPrompt(md) {
    this.prompt.html(markdown(md))
  }
  appendPrompt(md) {
    this.prompt.append(markdown(md))
  }

  async button(text='continue', opts={}) {
    _.defaults(opts, {delay: 0})
    let btn = button(this.prompt, text, opts)
    await btn.clicked
    btn.remove()
  }

  skipNextClear() {
    this.skipNext = true
  }


  async runStage(n) {
    logEvent(`instructions.runStage.${n}`, {stage: this.stages[n-1].name})
    this._sleep?.reject()
    if (this.skipNext) {
      this.skipNext = false
    } else {
      this.prompt.empty()
      this.content.empty()
    }
    this.content.css({opacity: 1}) // just to be safe
    this.maxStage = Math.max(this.maxStage, n)
    this.stage = n
    this.btnNext.prop('disabled', this.stage >= this.maxStage)
    this.btnPrev.prop('disabled', this.stage <= 1)
    this.title.text(`Instructions (${this.stage}/${this.stages.length})`)

    await this.stages[n-1].bind(this)()
    if (this.stage == n) {
      // check to make sure we didn't already move forward
      this.enableNext()
    }
  }

  runNext() {
    saveData()
    logEvent('instructions.runNext')
    this.btnNext.removeClass('btn-pulse')
    if (this.stage == this.stages.length) {
      logEvent('instructions.completed')
      psiturk.finishInstructions();
      this.completed.resolve()
      this.div.remove()
    } else {
      this.runStage(this.stage + 1)
    }
  }

  runPrev() {
    logEvent('instructions.runPrev')
    this.runStage(this.stage - 1)
  }

  enableNext() {
    this.btnNext.addClass('btn-pulse')
    this.maxStage = this.stage + 1
    this.btnNext.prop('disabled', false)
  }
}