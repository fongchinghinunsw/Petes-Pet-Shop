App = {
  web3Provider: null,
  contracts: {},

  init: async function () {
    // Load pets.
    $.getJSON("../pets.json", function (data) {
      var petsRow = $("#petsRow");
      var petTemplate = $("#petTemplate");

      for (i = 0; i < data.length; i++) {
        petTemplate.find(".panel-title").text(data[i].name);
        petTemplate.find("img").attr("src", data[i].picture);
        petTemplate.find(".pet-breed").text(data[i].breed);
        petTemplate.find(".pet-age").text(data[i].age);
        petTemplate.find(".pet-location").text(data[i].location);
        petTemplate.find(".btn-adopt").attr("data-id", data[i].id);

        petsRow.append(petTemplate.html());
      }
    });

    return await App.initWeb3();
  },

  initWeb3: async function () {
    // Modern dapp browsers...
    // We check if we are using modern dapp browsers or the more recent versions
    // of MetaMask where an ethereum provider is injected into the window object.
    // If so, we use it to create our web3 object.
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      try {
        // We also need to explicitly request access to the accounts
        // ethereum.enable() is the old way, use ethereum.request() instead
        await window.ethereum.request({ method: "eth_requestAccounts" });
      } catch (error) {
        // User denied account access...
        console.error("User denied account access");
      }
    }
    // Legacy dapp browsers...
    // If the ethereum object does not exist, we then check for an injected
    // web3 instance. If it exists, this indicates that we are using an older
    // dapp browser (like Mist or an older version of MetaMask). If so, we get its
    // provider and use it to create our web3 object.
    else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      App.web3Provider = new Web3.providers.HttpProvider(
        "http://localhost:7545"
      );
    }
    web3 = new Web3(App.web3Provider);
    return App.initContract();
  },

  initContract: function () {
    // Now that we can interact with Ethereum via web3, we need to instantiate our
    // smart contract so web3 knows where to find it and how it works. Truffle has
    // a library to help with this called @truffle/contract. It keeps information
    // about the contract in sync with migrations, so you don't need to change the
    // contract's deployed address manually.
    $.getJSON("Adoption.json", function (data) {
      // Get the necessary contract artifact file and instantiate it with @truffle/contract
      // Artifacts are information about our contract such as its deployed address and Application
      // Binary Interface (ABI). The ABI is a JavaScript object defining how to interact with the
      // contract including its variables, functions and their parameters.
      var AdoptionArtifact = data;
      // Once we have the artifacts in our callback, we pass them to TruffleContract(). This
      // creates an instance of the contract we can interact with.
      App.contracts.Adoption = TruffleContract(AdoptionArtifact);

      // Set the provider for our contract
      App.contracts.Adoption.setProvider(App.web3Provider);

      // Use our contract to retrieve and mark the adopted pets
      return App.markAdopted();
    });

    return App.bindEvents();
  },

  bindEvents: function () {
    $(document).on("click", ".btn-adopt", App.handleAdopt);
  },

  markAdopted: function () {
    var adoptionInstance;

    App.contracts.Adoption.deployed()
      .then(function (instance) {
        adoptionInstance = instance;
        // call getAdopters() on that contract instance
        // Using call() allows us to read data from the blockchain
        return adoptionInstance.getAdopters.call();
      })
      .then(function (adopters) {
        // After calling getAdopters(), we then loop through all of them, checking
        // to see if an address is stored for each pet. Since the array contains
        // address types, Ethereum initializes the array with 16 empty addresses.
        // This is why we check for an empty address string rather than null or
        // other falsey value.
        for (i = 0; i < adopters.length; i++) {
          if (adopters[i] !== "0x0000000000000000000000000000000000000000") {
            // Once a petId with a corresponding address is found, we disable its
            // adopt button and change the button text to "Success", so the user
            // gets some feedback.
            $(".panel-pet")
              .eq(i)
              .find("button")
              .text("Success")
              .attr("disabled", true);
          }
        }
      })
      .catch(function (err) {
        console.log(err.message);
      });
  },

  handleAdopt: function (event) {
    event.preventDefault();

    var petId = parseInt($(event.target).data("id"));

    var adoptionInstance;

    // We use web3 to get the user's accounts
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      var account = accounts[0];

      App.contracts.Adoption.deployed()
        .then(function (instance) {
          adoptionInstance = instance;

          // Execute adopt as a transaction by sending account
          return adoptionInstance.adopt(petId, { from: account });
        })
        // The result of sending a transaction is the transaction object.
        // If there are no errors, we proceed to call our markAdopted()
        // function to sync the UI with our newly stored data.
        .then(function (result) {
          return App.markAdopted();
        })
        .catch(function (err) {
          console.log(err.message);
        });
    });
  },
};

$(function () {
  $(window).load(function () {
    App.init();
  });
});
