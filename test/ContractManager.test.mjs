import { expect } from "chai";
import hardhat from "hardhat";
import { keccak256, toUtf8Bytes, parseEther, ZeroAddress } from "ethers";

const { ethers } = hardhat;
const oneEth = parseEther("1");
const halfEth = parseEther("0.5");

const contractHash = keccak256(toUtf8Bytes("kaufvertrag-privat-an-privat.pdf"));
const trackingHash = keccak256(toUtf8Bytes("JJD1234567890"));

const ContractStatus = {
  Created: 0,
  Signed: 1,
  DeliverySet: 2,
  DeliveryConfirmed: 3,
  DeliveryApproved: 4,
  AgreementFulfilled: 5,
  Completed: 6,
  Cancelled: 7,
};

describe("ContractManager Testsuite", () => {
  let contract;
  let creator, counterparty, oracle, other;

  beforeEach(async () => {
    [creator, counterparty, oracle, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ContractManager");
    contract = await Factory.connect(creator).deploy();
    await contract.waitForDeployment();
  });

  /* ✅ Prozesspfade */
  describe("✅ Prozesspfade", () => {
	it("(T-1)PZ-1 Vertrag nur mit Vertragserfüllung erfolgreich", async () => {
      await contract.connect(creator).createContract(counterparty.address, contractHash, oneEth, { value: oneEth });
      await contract.connect(counterparty).signContract(1);
      await contract.connect(creator).confirmCompletion(1);

      await expect(() => contract.connect(counterparty).withdrawFundsFrom(1))
        .to.changeEtherBalance(counterparty, oneEth);

      expect(await contract.getContractStatus(1)).to.equal(ContractStatus.Completed);
    });
  
    it("(T-2)PZ-2 Vertrag mit Lieferung erfolgreich", async () => {
      await contract.connect(creator).createContract(counterparty.address, contractHash, oneEth, { value: oneEth });
      await contract.connect(counterparty).signContract(1);
      await contract.connect(counterparty).setDeliveryTracking(1, trackingHash);
      await contract.setOracle(oracle.address);
      await contract.connect(oracle).confirmDeliveryByOracle(1, trackingHash);
      await contract.connect(creator).approveDeliveryAsCreator(1);

      await expect(() => contract.connect(counterparty).withdrawFundsFrom(1))
        .to.changeEtherBalance(counterparty, oneEth);

      expect(await contract.getContractStatus(1)).to.equal(ContractStatus.Completed);
    });
  });

  /* 🔒 Zugangskontrollen */
  describe("🔒 Zugangskontrollen", () => {
    beforeEach(async () => {
      await contract.setOracle(await oracle.getAddress());
      await contract.connect(creator).createContract(counterparty.address, contractHash, halfEth, { value: halfEth });
    });

    it("(T-3)non-counterparty darf Vertrag nicht bestätigen", async () => {
      await expect(contract.connect(other).signContract(1)).to.be.revertedWith("Not counterparty");
    });

    it("(T-4)non-creator darf Lieferung nicht bestätigen", async () => {
      await contract.connect(counterparty).signContract(1);
      await contract.connect(counterparty).setDeliveryTracking(1, trackingHash);
      await contract.connect(oracle).confirmDeliveryByOracle(1, trackingHash);
      await expect(contract.connect(other).approveDeliveryAsCreator(1)).to.be.revertedWith("Not creator");
    });

    it("(T-5)non-oracle darf Lieferinformationen nicht senden", async () => {
      await contract.connect(counterparty).signContract(1);
      await contract.connect(counterparty).setDeliveryTracking(1, trackingHash);
      await expect(contract.connect(other).confirmDeliveryByOracle(1, trackingHash)).to.be.revertedWith("Not oracle");
    });

    it("(T-6)zweites Oracle-Set verboten", async () => {
      await expect(contract.setOracle(other.address)).to.be.revertedWith("Oracle already set");
    });

    it("(T-7)non-counterparty darf keine Sendungsnummer setzen", async () => {
      await contract.connect(counterparty).signContract(1);
      await expect(contract.connect(other).setDeliveryTracking(1, trackingHash)).to.be.revertedWith("Not counterparty");
    });

    it("(T-8)non-counterparty darf nicht Beträge abheben", async () => {
      await contract.connect(counterparty).signContract(1);
      await contract.connect(counterparty).setDeliveryTracking(1, trackingHash);
      await contract.connect(oracle).confirmDeliveryByOracle(1, trackingHash);
      await contract.connect(creator).approveDeliveryAsCreator(1);
      await expect(contract.connect(other).withdrawFundsFrom(1)).to.be.revertedWith("Not counterparty");
    });
  });

  /* 🔁 Zustands Übergänge */
  describe("🔁 Zustands Übergänge", () => {
    beforeEach(async () => {
      await contract.connect(creator).createContract(counterparty.address, contractHash, oneEth, { value: oneEth });
      await contract.connect(counterparty).signContract(1);
    });

    it("(T-9)withdrawFundsFrom vor Freigabe verboten", async () => {
      await expect(contract.connect(counterparty).withdrawFundsFrom(1)).to.be.revertedWith("Not withdrawable");
    });

    it("(T-10)Hash-Mismatch wenn Oracle falschen Tracking-Hash bereitstellt", async () => {
      await contract.connect(counterparty).setDeliveryTracking(1, trackingHash);
      await contract.setOracle(oracle.address);
      await expect(
        contract.connect(oracle).confirmDeliveryByOracle(1, keccak256(toUtf8Bytes("JJD1234567891")))
      ).to.be.revertedWith("Hash mismatch");
    });

    it("(T-11)zweites withdrawFundsFrom am gleichen Vertrag verweigert", async () => {
      await contract.connect(creator).confirmCompletion(1);
      await contract.connect(counterparty).withdrawFundsFrom(1);
      await expect(contract.connect(counterparty).withdrawFundsFrom(1)).to.be.revertedWith("Not withdrawable");
    });

    it("(T-12)deaktivieren vor Completed blockiert", async () => {
      await expect(contract.connect(creator).deactivateContract(1)).to.be.revertedWith("Only Completed");
    });

    it("(T-13)doppeltes bestätigen von Verträgen ist verboten", async () => {
      await contract.connect(creator).createContract(counterparty.address, contractHash, oneEth, { value: oneEth });
      await contract.connect(counterparty).signContract(2);
      await expect(contract.connect(counterparty).signContract(2)).to.be.revertedWith("Not Created");
    });

    it("(T-14)confirmCompletion nicht erlaubt wenn Lieferung gesetzt", async () => {
      await contract.connect(counterparty).setDeliveryTracking(1, trackingHash);
      await expect(contract.connect(creator).confirmCompletion(1)).to.be.revertedWith("Not signed");
    });

    it("(T-15)setDeliveryTracking darf nur einmal erfolgen", async () => {
      await contract.connect(counterparty).setDeliveryTracking(1, trackingHash);
      await expect(contract.connect(counterparty).setDeliveryTracking(1, trackingHash)).to.be.revertedWith("Not Signed");
    });
	
	it("(T-16)approveDelivery ohne Oracle-Bestätigung verboten", async () => {
      await contract.connect(counterparty).setDeliveryTracking(1, trackingHash);
      await expect(contract.connect(creator).approveDeliveryAsCreator(1)).to.be.revertedWith("Wrong status");
    });
  });

  /* 🔐 Sicherheit: Reentrancy */
  describe("🔐 Sicherheit: Reentrancy", () => {
    it("(T-17)Reentrancy wird blockiert", async () => {
      const Malicious = await ethers.getContractFactory("MaliciousReceiver", counterparty);
      const malicious = await Malicious.deploy(await contract.getAddress());
      await malicious.waitForDeployment();

      await contract.connect(creator).createContract(malicious.getAddress(), contractHash, oneEth, { value: oneEth });
      await malicious.connect(counterparty).signContract(1);
      await contract.connect(creator).confirmCompletion(1);

      await expect(() => malicious.connect(counterparty).attack(1)).to.changeEtherBalance(malicious, oneEth);
      await expect(malicious.connect(counterparty).attack(1)).to.be.revertedWith("Not withdrawable");
    });
  });

  /* 🧨 Edge Cases */
  describe("🧨 Edge Cases", () => {
    it("(T-18)0-Adresse verboten", async () => {
      await expect(
        contract.connect(creator).createContract(ZeroAddress, contractHash, halfEth, { value: halfEth })
      ).to.be.revertedWith("0 addr not allowed");
    });

    it("(T-19)ETH-Mismatch zwischen msg.value und Parameterübergabe verboten", async () => {
      await expect(
        contract.connect(creator).createContract(counterparty.address, contractHash, oneEth, { value: halfEth })
      ).to.be.revertedWith("ETH mismatch");
    });

    it("(T-20)createContract mit 0 ETH erlaubt wenn Betrag 0 ist", async () => {
      await expect(
        contract.connect(creator).createContract(counterparty.address, contractHash, 0, { value: 0 })
      ).to.not.be.reverted;
    });

    it("(T-21)withdrawFundsFrom durch Dritte verboten", async () => {
      await contract.connect(creator).createContract(counterparty.address, contractHash, oneEth, { value: oneEth });
      await contract.connect(counterparty).signContract(1);
      await contract.connect(creator).confirmCompletion(1);
      await expect(contract.connect(other).withdrawFundsFrom(1)).to.be.revertedWith("Not counterparty");
    });
	
	it("(T-22)withdrawFundsFrom mit 0 auszahlbaren Betrag scheitert", async () => {
      await contract.connect(creator).createContract(counterparty.address, contractHash, oneEth, { value: oneEth });
      await contract.connect(counterparty).signContract(1);
      await expect(contract.connect(counterparty).withdrawFundsFrom(1)).to.be.revertedWith("Not withdrawable");
     });

    it("(T-23)deaktivieren nach Status Completed erlaubt", async () => {
      await contract.connect(creator).createContract(counterparty.address, contractHash, oneEth, { value: oneEth });
      await contract.connect(counterparty).signContract(1);
      await contract.connect(creator).confirmCompletion(1);
      await contract.connect(counterparty).withdrawFundsFrom(1);
      await contract.connect(creator).deactivateContract(1);
      expect(await contract.getContractStatus(1)).to.equal(ContractStatus.Cancelled);
    });
  });
  describe("⛽️ Gasverbrauch einzelner Smart Contract nur für Vergleich", () => {
    it("Deployment & Vertragsabschluss (ohne Lieferung)", async () => {
      const Factory = await ethers.getContractFactory("ContractInstance");
      const txDeploy = await Factory.connect(creator).deploy(counterparty.address, contractHash, { value: oneEth });
      const receiptDeploy = await txDeploy.deploymentTransaction();
      const contractAddress = await txDeploy.getAddress();
      const deployed = await ethers.getContractAt("ContractInstance", contractAddress);
      const txSign = await deployed.connect(counterparty).signContract();
      const receiptSign = await txSign.wait();
      const txComplete = await deployed.connect(creator).confirmCompletion();
      const receiptComplete = await txComplete.wait();
      const txWithdraw = await deployed.connect(counterparty).withdrawFunds();
      const receiptWithdraw = await txWithdraw.wait();
	  const txDeactivate = await deployed.connect(creator).deactivateContract();
	  const receiptDeactivation = await txDeactivate.wait();
    });
	it("Deployment & Vertragsabschluss (mit Lieferung)", async () => {
      const Factory = await ethers.getContractFactory("ContractInstance");
      const txDeploy = await Factory.connect(creator).deploy(counterparty.address, contractHash, { value: oneEth });
      const receiptDeploy = await txDeploy.deploymentTransaction();
      const contractAddress = await txDeploy.getAddress();
      const deployed = await ethers.getContractAt("ContractInstance", contractAddress);
      const txSetOracle = await deployed.connect(creator).setOracle(oracle.address);
      const receiptSetOracle = await txSetOracle.wait();
      const txSign = await deployed.connect(counterparty).signContract();
      const receiptSign = await txSign.wait();
      const txSetTracking = await deployed.connect(counterparty).setDeliveryTracking(trackingHash);
      const receiptSetTracking = await txSetTracking.wait();
      const txOracleConfirm = await deployed.connect(oracle).confirmDeliveryByOracle(trackingHash);
      const receiptOracleConfirm = await txOracleConfirm.wait();
      const txApprove = await deployed.connect(creator).approveDeliveryAsCreator();
      const receiptApprove = await txApprove.wait();
      const txWithdraw = await deployed.connect(counterparty).withdrawFunds();
      const receiptWithdraw = await txWithdraw.wait();
	  const txDeactivate = await deployed.connect(creator).deactivateContract();
	  const receiptDeactivation = await txDeactivate.wait();
});

  });
});
