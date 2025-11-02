
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SOVRCreditBridgePOS } from "../typechain-types";
import "@nomicfoundation/hardhat-chai-matchers";

describe("SOVRCreditBridgePOS", function () {
  let owner: SignerWithAddress,
    relayer: SignerWithAddress,
    user: SignerWithAddress,
    merchant: SignerWithAddress;
  let sovrCreditBridgePOS: SOVRCreditBridgePOS;
  const MAX_SUPPLY = ethers.parseEther("250000");
  const merchantId = ethers.encodeBytes32String("merchant1");

  async function deploySOVRCreditBridgePOSFixture() {
    [owner, relayer, user, merchant] = await ethers.getSigners();

    const SOVRCreditBridgePOSFactory = await ethers.getContractFactory(
      "SOVRCreditBridgePOS"
    );
    sovrCreditBridgePOS = (await SOVRCreditBridgePOSFactory.deploy(
      owner.address,
      relayer.address,
      "SOVR Credit",
      "SOVR"
    )) as SOVRCreditBridgePOS;

    await sovrCreditBridgePOS.waitForDeployment();

    // Transfer some tokens to the user for testing
    await sovrCreditBridgePOS.transfer(user.address, ethers.parseEther("1000"));

    return { sovrCreditBridgePOS, owner, relayer, user, merchant };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { sovrCreditBridgePOS, owner } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      expect(await sovrCreditBridgePOS.owner()).to.equal(owner.address);
    });

    it("Should set the right relayer", async function () {
      const { sovrCreditBridgePOS, relayer } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      expect(await sovrCreditBridgePOS.relayerAddress()).to.equal(relayer.address);
    });

    it("Should mint the total supply to the owner, minus the user's tokens", async function () {
      const { sovrCreditBridgePOS, owner } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      const ownerBalance = await sovrCreditBridgePOS.balanceOf(owner.address);
      const expectedBalance = MAX_SUPPLY - ethers.parseEther("1000");
      expect(ownerBalance).to.equal(expectedBalance);
    });
  });

  describe("Owner-Only Functions", function () {
    it("Should allow the owner to set a merchant wallet", async function () {
      const { sovrCreditBridgePOS, owner, merchant } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      await expect(
        sovrCreditBridgePOS
          .connect(owner)
          .setMerchantWallet(merchantId, merchant.address)
      )
        .to.emit(sovrCreditBridgePOS, "MerchantWalletUpdated")
        .withArgs(merchantId, merchant.address);
      expect(await sovrCreditBridgePOS.merchantWallets(merchantId)).to.equal(
        merchant.address
      );
    });

    it("Should not allow a non-owner to set a merchant wallet", async function () {
      const { sovrCreditBridgePOS, user, merchant } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      await expect(
        sovrCreditBridgePOS
          .connect(user)
          .setMerchantWallet(merchantId, merchant.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow the owner to pause and unpause the contract", async function () {
      const { sovrCreditBridgePOS, owner } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      await expect(sovrCreditBridgePOS.connect(owner).pause())
        .to.emit(sovrCreditBridgePOS, "Paused")
        .withArgs(owner.address);
      expect(await sovrCreditBridgePOS.paused()).to.be.true;

      await expect(sovrCreditBridgePOS.connect(owner).unpause())
        .to.emit(sovrCreditBridgePOS, "Unpaused")
        .withArgs(owner.address);
      expect(await sovrCreditBridgePOS.paused()).to.be.false;
    });

    it("Should not allow a non-owner to pause or unpause the contract", async function () {
      const { sovrCreditBridgePOS, user, owner } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      await expect(sovrCreditBridgePOS.connect(user).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await sovrCreditBridgePOS.connect(owner).pause();
      await expect(sovrCreditBridgePOS.connect(user).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should allow the owner to withdraw tokens", async function () {
      const { sovrCreditBridgePOS, user } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      const amount = ethers.parseEther("100");
      const contractAddress = await sovrCreditBridgePOS.getAddress();
      await sovrCreditBridgePOS.transfer(contractAddress, amount);
      const initialUserBalance = await sovrCreditBridgePOS.balanceOf(user.address);
      await sovrCreditBridgePOS.ownerWithdraw(user.address, amount);
      const finalUserBalance = await sovrCreditBridgePOS.balanceOf(user.address);
      expect(finalUserBalance - initialUserBalance).to.equal(amount);
    });

    it("Should not allow a non-owner to withdraw tokens", async function () {
      const { sovrCreditBridgePOS, user } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      const amount = ethers.parseEther("100");
      const contractAddress = await sovrCreditBridgePOS.getAddress();
      await sovrCreditBridgePOS.transfer(contractAddress, amount);
      await expect(
        sovrCreditBridgePOS.connect(user).ownerWithdraw(user.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Payment Functions", function () {
    beforeEach(async function () {
      const { sovrCreditBridgePOS, owner, merchant } = await loadFixture(
        deploySOVRCreditBridgePOSFixture
      );
      await sovrCreditBridgePOS
        .connect(owner)
        .setMerchantWallet(merchantId, merchant.address);
    });

    describe("approveAndBurn (Gasless Flow)", function () {
      it("Should allow a user to pay via permit", async function () {
        const { sovrCreditBridgePOS, relayer, user } = await loadFixture(
          deploySOVRCreditBridgePOSFixture
        );
        const amount = ethers.parseEther("100");
        const deadline = (await time.latest()) + 60 * 60;
        const nonce = await sovrCreditBridgePOS.nonces(user.address);

        const domain = {
          name: "SOVR Credit",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await sovrCreditBridgePOS.getAddress(),
        };

        const types = {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        };

        const values = {
          owner: user.address,
          spender: relayer.address,
          value: amount,
          nonce: nonce,
          deadline: deadline,
        };

        const signature = await user.signTypedData(domain, types, values);
        const { v, r, s } = ethers.Signature.from(signature);

        const initialUserBalance = await sovrCreditBridgePOS.balanceOf(user.address);

        await expect(
          sovrCreditBridgePOS
            .connect(relayer)
            .approveAndBurn(
              user.address,
              merchantId,
              amount,
              deadline,
              v,
              r,
              s
            )
        )
          .to.emit(sovrCreditBridgePOS, "PaymentBurned")
          .withArgs(user.address, merchantId, amount);

        const finalUserBalance = await sovrCreditBridgePOS.balanceOf(user.address);
        expect(initialUserBalance - finalUserBalance).to.equal(amount);
      });

      it("Should not allow a user to pay via permit with an invalid signature", async function () {
        const { sovrCreditBridgePOS, relayer, user } = await loadFixture(
          deploySOVRCreditBridgePOSFixture
        );
        const amount = ethers.parseEther("100");
        const deadline = (await time.latest()) + 60 * 60;
        const nonce = await sovrCreditBridgePOS.nonces(user.address);

        const domain = {
          name: "SOVR Credit",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await sovrCreditBridgePOS.getAddress(),
        };

        const types = {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        };

        const values = {
          owner: user.address,
          spender: relayer.address,
          value: amount,
          nonce: nonce,
          deadline: deadline,
        };

        const signature = await relayer.signTypedData(domain, types, values); // Signed by wrong user
        const { v, r, s } = ethers.Signature.from(signature);

        await expect(
          sovrCreditBridgePOS
            .connect(relayer)
            .approveAndBurn(
              user.address,
              merchantId,
              amount,
              deadline,
              v,
              r,
              s
            )
        ).to.be.revertedWith("ERC20Permit: invalid signature");
      });
    });

    describe("burnForPOS (Allowance-Based Flow)", function () {
      it("Should allow the relayer to burn tokens on behalf of a user", async function () {
        const { sovrCreditBridgePOS, relayer, user } = await loadFixture(
          deploySOVRCreditBridgePOSFixture
        );
        const amount = ethers.parseEther("100");
        await sovrCreditBridgePOS.connect(user).approve(relayer.address, amount);

        const initialUserBalance = await sovrCreditBridgePOS.balanceOf(user.address);

        await expect(
          sovrCreditBridgePOS
            .connect(relayer)
            .burnForPOS(user.address, merchantId, amount)
        )
          .to.emit(sovrCreditBridgePOS, "PaymentBurned")
          .withArgs(user.address, merchantId, amount);

        const finalUserBalance = await sovrCreditBridgePOS.balanceOf(user.address);
        expect(initialUserBalance - finalUserBalance).to.equal(amount);
      });

      it("Should not allow a non-relayer to burn tokens", async function () {
        const { sovrCreditBridgePOS, user } = await loadFixture(
          deploySOVRCreditBridgePOSFixture
        );
        const amount = ethers.parseEther("100");
        await sovrCreditBridgePOS.connect(user).approve(user.address, amount);

        await expect(
          sovrCreditBridgePOS
            .connect(user)
            .burnForPOS(user.address, merchantId, amount)
        ).to.be.revertedWith("SOVRPOS: Caller is not the authorized relayer");
      });

      it("Should not allow the relayer to burn more tokens than approved", async function () {
        const { sovrCreditBridgePOS, relayer, user } = await loadFixture(
          deploySOVRCreditBridgePOSFixture
        );
        const amount = ethers.parseEther("100");
        await sovrCreditBridgePOS.connect(user).approve(relayer.address, amount);

        await expect(
          sovrCreditBridgePOS
            .connect(relayer)
            .burnForPOS(user.address, merchantId, amount + 1n)
        ).to.be.revertedWith("ERC20: insufficient allowance");
      });
    });
  });
});
